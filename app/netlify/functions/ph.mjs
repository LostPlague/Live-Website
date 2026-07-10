// Control Center backend — the ONLY place the PostHog personal key lives.
// The browser sends { password, mode, days, tz, personId?, showBots? }; we
// validate the password server-side, run fixed HogQL against PostHog, and
// return shaped results. The client can never see the key or run arbitrary SQL.
//
// Data rules (v3):
//  • LAUNCH FLOOR — everything before EPOCH is invisible (pre-launch tests +
//    crawler noise from the polluted v1/v2 era stay in PostHog but never here).
//  • ENGAGEMENT GATE — a person only counts as a real visitor if they did
//    something a crawler won't: clicked Start, touched Secret Files, downloaded
//    the resume, messaged, played radio/minesweeper, opened a 2nd app, or fired
//    6+ custom events. Everything else is a bot (counted, inspectable, never
//    mixed into visitor stats).
//  • OWNER SPLIT — events stamped is_owner (Med's tagged browsers) roll into a
//    single "owner" profile reported separately, excluded from every number.
//
// Netlify env vars required: POSTHOG_PERSONAL_KEY, ADMIN_PASSWORD.

import { timingSafeEqual } from 'node:crypto';

const PH_HOST = 'https://us.i.posthog.com';
const PROJECT = '503872';

// v3 clean-slate: the dashboard's book starts here (UTC).
const EPOCH = "toDateTime('2026-07-10 00:00:00')";

// Baseline event filter: production traffic only, since the epoch.
const BASE =
  `properties.$host NOT LIKE 'localhost%' AND properties.$host NOT LIKE '%.netlify.app%'` +
  ` AND event != '__verify_test__' AND timestamp >= ${EPOCH}`;

// What makes a person a real human (evaluated per person over all their events):
// they ENGAGED like a person AND carry no headless-renderer fingerprint.
const ENGAGED = `(
     countIf(event = 'experience_started') > 0
  OR countIf(event = 'resume_downloaded') > 0
  OR countIf(event LIKE 'secret_%') > 0
  OR countIf(event = 'contact_submitted') > 0
  OR countIf(event = 'minesweeper_result') > 0
  OR countIf(event = 'radio_play') > 0
  OR countIf(event = 'link_clicked') > 0
  OR uniqIf(properties.app, event = 'app_opened') >= 2
  OR countIf(event NOT LIKE '$%') >= 6
)`;
// Renderer bots (e.g. Google's indexer from Council Bluffs) DO click prominent
// buttons, so engagement alone isn't proof. No real person can trip these:
// browsers always report a real timezone, and no real device has a perfectly
// square screen (1024×1024 is a headless viewport default).
const BOTLIKE = `(
     countIf(properties.$timezone = 'Etc/Unknown') > 0
  OR countIf(toFloat(properties.$screen_width) > 0 AND properties.$screen_width = properties.$screen_height) > 0
)`;
const HUMAN = `(${ENGAGED} AND NOT ${BOTLIKE})`;
const OWNER = `(countIf(properties.is_owner = true) > 0 OR countIf(distinct_id = 'owner') > 0)`;

// Person set used to scope every stat to engaged, non-owner humans.
const HUMAN_IDS = `SELECT person_id FROM events WHERE ${BASE} GROUP BY person_id HAVING ${HUMAN} AND NOT ${OWNER}`;

async function hog(query) {
  const res = await fetch(`${PH_HOST}/api/projects/${PROJECT}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`posthog ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).results || [];
}

const j = (obj, status = 200) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});

function passwordOk(given) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  try { return timingSafeEqual(Buffer.from(given), Buffer.from(expected)); } catch { return false; }
}

const scalar = (rows, i = 0) => (rows[0] && rows[0][i] != null ? Number(rows[0][i]) : 0);
const num = (v) => (v == null ? 0 : Number(v));

// CLS is a 0–1 float — keep 3 decimals instead of collapsing to 0.
const float3 = (rows, i) => {
  const v = rows[0] ? rows[0][i] : null;
  return v == null ? 0 : Math.round(Number(v) * 1000) / 1000;
};

// Engagement score → lead class. Weights favor recruiter signals.
function scoreOf(r) {
  const dwellMin = num(r.dwell) / 60;
  const s =
    (r.resume ? 40 : 0) + (r.contact ? 30 : 0) + (r.matrix ? 25 : 0) +
    r.stages * 5 + Math.min(r.apps, 5) * 3 + Math.min(dwellMin, 15) + (r.started ? 5 : 0);
  return Math.min(100, Math.round(s));
}
const classOf = (score) => (score >= 50 ? 'hot' : score >= 15 ? 'explorer' : 'passerby');

// Shared roster: every engaged human + the owner, all-time since epoch.
// Ordered by first-seen so visitor numbering is stable forever.
const ROSTER_SQL = `
  SELECT person_id, min(timestamp) f, max(timestamp) l, count() ev,
    countIf(event NOT LIKE '$%') cust,
    uniqIf(properties.$session_id, properties.$session_id != '') sess,
    countIf(event = 'resume_downloaded') dl,
    countIf(event = 'secret_completed') mx,
    countIf(event = 'contact_submitted') ct,
    countIf(event = 'secret_stage_passed') stages,
    countIf(event = 'experience_started') started,
    sumIf(coalesce(toFloat(properties.seconds), 0), event = 'app_closed') dwell,
    uniqIf(properties.app, event = 'app_opened') apps,
    any(properties.$geoip_country_name) country, any(properties.$geoip_city_name) city,
    any(properties.$device_type) device, any(properties.$browser) browser,
    any(properties.$geoip_latitude) lat, any(properties.$geoip_longitude) lon,
    (countIf(properties.is_owner = true) > 0 OR countIf(distinct_id = 'owner') > 0) owner
  FROM events WHERE ${BASE}
  GROUP BY person_id
  HAVING ${HUMAN} OR ${OWNER}
  ORDER BY f ASC LIMIT 500`;

function shapeRoster(rows) {
  let owner = null;
  const visitors = [];
  let seq = 0;
  for (const r of rows) {
    const o = {
      id: r[0], first: r[1], last: r[2], events: num(r[3]), custom: num(r[4]),
      sessions: num(r[5]), resume: num(r[6]) > 0, matrix: num(r[7]) > 0,
      contact: num(r[8]) > 0, stages: num(r[9]), started: num(r[10]) > 0,
      dwell: num(r[11]), apps: num(r[12]),
      country: r[13], city: r[14], device: r[15], browser: r[16],
      lat: r[17] == null ? null : Number(r[17]), lon: r[18] == null ? null : Number(r[18]),
    };
    if (Number(r[19]) > 0) {
      // merge any stray owner person-rows into one profile
      if (!owner) owner = { ...o, num: 'YOU' };
      else {
        owner.events += o.events; owner.sessions += o.sessions; owner.dwell += o.dwell;
        if (o.first < owner.first) owner.first = o.first;
        if (o.last > owner.last) owner.last = o.last;
      }
      continue;
    }
    seq += 1;
    const score = scoreOf(o);
    visitors.push({
      ...o,
      num: 'Visitor ' + String(seq).padStart(3, '0'),
      returning: num(r[5]) > 1,
      score, class: classOf(score),
    });
  }
  return { visitors, owner };
}

// Tiny in-memory cache (Netlify reuses warm containers): the dashboard polls
// every 60s and page switches re-fetch — no need to hit PostHog each time.
const cache = new Map();
const TTL_MS = 25_000;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return j({ error: 'method not allowed' }, 405);
  if (!process.env.POSTHOG_PERSONAL_KEY || !process.env.ADMIN_PASSWORD) {
    return j({ error: 'server not configured — set POSTHOG_PERSONAL_KEY and ADMIN_PASSWORD in Netlify' }, 500);
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return j({ error: 'bad request' }, 400); }
  if (!passwordOk(body.password)) return j({ error: 'unauthorized' }, 401);

  const mode = ['overview', 'visitors', 'visitor', 'challenge', 'content', 'system'].includes(body.mode)
    ? body.mode : 'overview';
  const days = [1, 7, 30, 90].includes(body.days) ? body.days : 7;
  const tz = typeof body.tz === 'string' && /^[A-Za-z][A-Za-z0-9_+/-]{0,50}$/.test(body.tz) ? body.tz : 'UTC';
  const showBots = body.showBots === true;

  const cacheKey = JSON.stringify({ mode, days, tz, showBots, pid: body.personId || '' });
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.t < TTL_MS) return j(hit.data);

  // Range scoping: identity/roster is all-time since epoch (stable numbering);
  // range-windowed stats additionally clip to the selected period.
  const CUR = `timestamp > now() - INTERVAL ${days} DAY`;
  const PREV = `timestamp <= now() - INTERVAL ${days} DAY AND timestamp > now() - INTERVAL ${days * 2} DAY`;
  const WV = `WHERE ${BASE} AND person_id IN (${HUMAN_IDS})`;

  try {
    let data;

    if (mode === 'visitor') {
      const pid = String(body.personId || '');
      if (!/^[0-9a-fA-F-]{36}$/.test(pid)) return j({ error: 'bad person id' }, 400);
      const P = `WHERE person_id = '${pid}' AND ${BASE}`;
      const [profile, timeline] = await Promise.all([
        hog(`SELECT
              any(properties.$geoip_country_name), any(properties.$geoip_city_name),
              any(properties.$geoip_subdivision_1_name), any(properties.$device_type),
              any(properties.$browser), any(properties.$os),
              any(properties.$screen_width), any(properties.$screen_height),
              any(properties.$referring_domain), any(properties.$geoip_time_zone),
              min(timestamp), max(timestamp), count(),
              uniqIf(properties.$session_id, properties.$session_id != '')
            FROM events ${P}`),
        hog(`SELECT timestamp, event, properties.app, properties.stage, properties.attemptsLeft,
              properties.seconds, properties.$current_url, properties.$session_id,
              properties.section, properties.target
            FROM events ${P} AND event != '$identify'
            ORDER BY timestamp ASC LIMIT 600`),
      ]);
      data = { profile: profile[0] || [], timeline, replayBase: `https://us.posthog.com/project/${PROJECT}/replay` };
    }

    else if (mode === 'visitors') {
      const [roster, allPersons, bots] = await Promise.all([
        hog(ROSTER_SQL),
        hog(`SELECT count(DISTINCT person_id) FROM events WHERE ${BASE}`),
        showBots
          ? hog(`SELECT person_id, min(timestamp) f, max(timestamp) l, count() ev,
                   any(properties.$geoip_country_name), any(properties.$geoip_city_name),
                   any(properties.$device_type), any(properties.$browser)
                 FROM events WHERE ${BASE} GROUP BY person_id
                 HAVING NOT ${HUMAN} AND NOT ${OWNER}
                 ORDER BY l DESC LIMIT 100`)
          : Promise.resolve([]),
      ]);
      const { visitors, owner } = shapeRoster(roster);
      data = { visitors, owner, botCount: Math.max(0, scalar(allPersons) - roster.length), bots };
    }

    else if (mode === 'challenge') {
      const [stages, totals, winners] = await Promise.all([
        hog(`SELECT properties.stage st,
               countIf(event = 'secret_stage_passed') passed,
               countIf(event = 'secret_wrong_answer') wrong,
               avgIf(toFloat(properties.seconds), event = 'secret_stage_passed' AND properties.seconds IS NOT NULL) avgsec
             FROM events ${WV} AND ${CUR} AND event IN ('secret_stage_passed','secret_wrong_answer')
             GROUP BY st`),
        hog(`SELECT countIf(event = 'secret_opened'), countIf(event = 'secret_completed'),
               countIf(event = 'secret_gave_up'), countIf(event = 'secret_failed'),
               uniqIf(person_id, event = 'secret_opened'), uniqIf(person_id, event = 'secret_completed')
             FROM events ${WV} AND ${CUR}`),
        hog(`SELECT person_id, max(timestamp) FROM events ${WV} AND event = 'secret_completed'
             GROUP BY person_id ORDER BY max(timestamp) DESC LIMIT 20`),
      ]);
      data = {
        stages,
        totals: {
          opened: scalar(totals, 0), completed: scalar(totals, 1), gaveUp: scalar(totals, 2),
          failed: scalar(totals, 3), openedPeople: scalar(totals, 4), completedPeople: scalar(totals, 5),
        },
        winners,
      };
    }

    else if (mode === 'content') {
      const [apps, sections, links, media, room, roomAll, hesitation, conv] = await Promise.all([
        hog(`SELECT properties.app a,
               countIf(event = 'app_opened') opens,
               uniqIf(person_id, event = 'app_opened') people,
               sumIf(coalesce(toFloat(properties.seconds), 0), event = 'app_closed') total_s,
               avgIf(toFloat(properties.seconds), event = 'app_closed' AND properties.seconds IS NOT NULL) avg_s
             FROM events ${WV} AND ${CUR} AND event IN ('app_opened','app_closed') AND a IS NOT NULL
             GROUP BY a ORDER BY opens DESC`),
        hog(`SELECT properties.section s, count() views, uniq(person_id) people,
               sumIf(coalesce(toFloat(properties.seconds), 0), properties.seconds IS NOT NULL) total_s,
               avgIf(toFloat(properties.seconds), properties.seconds IS NOT NULL) avg_s
             FROM events ${WV} AND ${CUR} AND event = 'section_viewed' AND s IS NOT NULL
             GROUP BY s ORDER BY total_s DESC`),
        hog(`SELECT properties.target t, count() n, uniq(person_id) people
             FROM events ${WV} AND ${CUR} AND event = 'link_clicked' AND t IS NOT NULL
             GROUP BY t ORDER BY n DESC`),
        hog(`SELECT countIf(event = 'radio_play'),
               sumIf(coalesce(toFloat(properties.seconds), 0), event = 'radio_listened'),
               countIf(event = 'minesweeper_result'),
               countIf(event = 'minesweeper_result' AND properties.result = 'won'),
               avgIf(toFloat(properties.seconds), event = 'minesweeper_result' AND properties.result = 'won'),
               avgIf(toFloat(properties.clicks), event = 'minesweeper_result' AND properties.clicks IS NOT NULL),
               avgIf(toFloat(properties.flags), event = 'minesweeper_result' AND properties.flags IS NOT NULL)
             FROM events ${WV} AND ${CUR}`),
        // 3D room journey — averages over the per-visit room_summary events
        hog(`SELECT avgIf(toFloat(properties.introSeconds), event = 'experience_started' AND properties.introSeconds IS NOT NULL),
               avgIf(toFloat(properties.wideSeconds), event = 'room_summary'),
               avgIf(toFloat(properties.deskSeconds), event = 'room_summary'),
               avgIf(toFloat(properties.monitorSeconds), event = 'room_summary'),
               avgIf(toFloat(properties.orbitSeconds), event = 'room_summary'),
               avgIf(toFloat(properties.afkSeconds), event = 'room_summary'),
               countIf(event = 'room_summary' AND properties.played = true),
               countIf(event = 'room_summary')
             FROM events ${WV} AND ${CUR}`),
        // start-vs-abandon over ALL traffic (abandoners rarely pass the human
        // gate by definition, so this one is measured against the whole book)
        hog(`SELECT countIf(event = 'experience_started'), countIf(event = 'experience_abandoned')
             FROM events WHERE ${BASE} AND ${CUR}
               AND person_id NOT IN (SELECT person_id FROM events WHERE ${BASE} GROUP BY person_id HAVING ${OWNER})`),
        // hesitation — meaningful hover targets, people + dwell
        hog(`SELECT properties.target t, uniq(person_id) people, round(sum(toFloat(properties.seconds)), 1) sec
             FROM events ${WV} AND ${CUR} AND event = 'element_hovered' AND t IS NOT NULL
             GROUP BY t ORDER BY people DESC LIMIT 12`),
        // conversion companions for the hesitation card
        hog(`SELECT uniqIf(person_id, event = 'resume_downloaded'),
               uniqIf(person_id, event = 'contact_submitted'),
               uniqIf(person_id, event = 'link_clicked' AND properties.target = 'linkedin'),
               uniqIf(person_id, event = 'link_clicked' AND properties.target = 'email'),
               uniqIf(person_id, event = 'experience_started')
             FROM events ${WV} AND ${CUR}`),
      ]);
      data = {
        apps, sections, links, hesitation,
        media: {
          radioPlays: scalar(media, 0), radioSeconds: scalar(media, 1),
          mineGames: scalar(media, 2), mineWins: scalar(media, 3), mineAvgWin: scalar(media, 4),
          mineAvgClicks: scalar(media, 5), mineAvgFlags: scalar(media, 6),
        },
        room: {
          introAvg: scalar(room, 0), wideAvg: scalar(room, 1), deskAvg: scalar(room, 2),
          monitorAvg: scalar(room, 3), orbitAvg: scalar(room, 4), afkAvg: scalar(room, 5),
          played: scalar(room, 6), summaries: scalar(room, 7),
          starts: scalar(roomAll, 0), abandons: scalar(roomAll, 1),
        },
        hesitationConv: {
          resume: scalar(conv, 0), 'contact-send': scalar(conv, 1),
          linkedin: scalar(conv, 2), email: scalar(conv, 3), 'start-button': scalar(conv, 4),
        },
      };
    }

    else if (mode === 'system') {
      const [devices, browsers, oses, screens, vitals, heat, perf, topErrors] = await Promise.all([
        hog(`SELECT properties.$device_type t, uniq(person_id) n FROM events ${WV} AND ${CUR} AND t != '' GROUP BY t ORDER BY n DESC LIMIT 5`),
        hog(`SELECT properties.$browser b, uniq(person_id) n FROM events ${WV} AND ${CUR} AND b != '' GROUP BY b ORDER BY n DESC LIMIT 6`),
        hog(`SELECT properties.$os o, uniq(person_id) n FROM events ${WV} AND ${CUR} AND o != '' GROUP BY o ORDER BY n DESC LIMIT 6`),
        hog(`SELECT concat(toString(properties.$screen_width), '×', toString(properties.$screen_height)) s, uniq(person_id) n
             FROM events ${WV} AND ${CUR} AND toFloat(properties.$screen_width) > 0
             GROUP BY s ORDER BY n DESC LIMIT 6`),
        hog(`SELECT avgIf(toFloat(properties.$web_vitals_LCP_value), properties.$web_vitals_LCP_value IS NOT NULL),
               avgIf(toFloat(properties.$web_vitals_FCP_value), properties.$web_vitals_FCP_value IS NOT NULL),
               avgIf(toFloat(properties.$web_vitals_CLS_value), properties.$web_vitals_CLS_value IS NOT NULL),
               avgIf(toFloat(properties.$web_vitals_INP_value), properties.$web_vitals_INP_value IS NOT NULL),
               countIf(event = '$web_vitals')
             FROM events ${WV} AND ${CUR}`),
        hog(`SELECT toDayOfWeek(timestamp, 0, '${tz}') d, toHour(toTimeZone(timestamp, '${tz}')) h, count()
             FROM events ${WV} AND ${CUR} GROUP BY d, h`),
        // stability & behavior: 3D frame rate, frustration clicks, JS errors
        hog(`SELECT round(avgIf(toFloat(properties.avg), event = 'fps_sample')),
               round(avgIf(toFloat(properties.min), event = 'fps_sample' AND properties.min IS NOT NULL)),
               countIf(event = 'fps_sample'),
               countIf(event = '$rageclick'), countIf(event = '$dead_click'),
               countIf(event = 'js_error'), countIf(event = 'webgl_failed')
             FROM events ${WV} AND ${CUR}`),
        hog(`SELECT properties.message m, count() n FROM events ${WV} AND ${CUR} AND event = 'js_error' AND m IS NOT NULL
             GROUP BY m ORDER BY n DESC LIMIT 4`),
      ]);
      data = {
        devices, browsers, oses, screens, heat, tz, topErrors,
        vitals: {
          lcp: scalar(vitals, 0), fcp: scalar(vitals, 1),
          cls: float3(vitals, 2), inp: scalar(vitals, 3), samples: scalar(vitals, 4),
        },
        perf: {
          fpsAvg: scalar(perf, 0), fpsMin: scalar(perf, 1), fpsSamples: scalar(perf, 2),
          rage: scalar(perf, 3), dead: scalar(perf, 4), errors: scalar(perf, 5), webglFails: scalar(perf, 6),
        },
      };
    }

    else {
      // ── overview ────────────────────────────────────────────────────────
      const [kpi, trend, funnel, referrers, recent, live, roster, allPersons] = await Promise.all([
        hog(`SELECT
               uniqIf(person_id, ${CUR}), uniqIf(person_id, ${PREV}),
               uniqIf(properties.$session_id, ${CUR} AND properties.$session_id != ''),
               uniqIf(properties.$session_id, ${PREV} AND properties.$session_id != ''),
               countIf(event = 'resume_downloaded' AND ${CUR}), countIf(event = 'resume_downloaded' AND ${PREV}),
               countIf(event = 'secret_completed' AND ${CUR}), countIf(event = 'secret_completed' AND ${PREV}),
               countIf(event = 'contact_submitted' AND ${CUR}), countIf(event = 'contact_submitted' AND ${PREV}),
               countIf(event = 'link_clicked' AND ${CUR}), countIf(event = 'link_clicked' AND ${PREV})
             FROM events ${WV}`),
        hog(`SELECT toDate(toTimeZone(timestamp, '${tz}')) d, uniq(person_id) n
             FROM events ${WV} AND timestamp > now() - INTERVAL ${days * 2} DAY
             GROUP BY d ORDER BY d`),
        hog(`SELECT event, properties.stage st, count() n
             FROM events ${WV} AND ${CUR}
               AND event IN ('secret_opened','secret_stage_passed','secret_wrong_answer','secret_completed')
             GROUP BY event, st`),
        hog(`SELECT properties.$referring_domain r, uniq(person_id) n
             FROM events ${WV} AND ${CUR} AND r != '' AND r != '$direct' AND r NOT LIKE '%mohamedtabari.com%'
             GROUP BY r ORDER BY n DESC LIMIT 6`),
        hog(`SELECT timestamp, event, properties.app, properties.$geoip_country_name, person_id,
               properties.stage, properties.section, properties.target
             FROM events ${WV} AND event NOT LIKE '$%' ORDER BY timestamp DESC LIMIT 30`),
        hog(`SELECT person_id, any(properties.$geoip_city_name), any(properties.$geoip_country_name),
               max(timestamp), count()
             FROM events WHERE ${BASE} AND timestamp > now() - INTERVAL 5 MINUTE
             GROUP BY person_id
             HAVING countIf(properties.is_owner = true) = 0 AND countIf(distinct_id = 'owner') = 0
             ORDER BY max(timestamp) DESC LIMIT 12`),
        hog(ROSTER_SQL),
        hog(`SELECT count(DISTINCT person_id) FROM events WHERE ${BASE}`),
      ]);
      const { visitors, owner } = shapeRoster(roster);
      data = {
        days, tz,
        kpis: {
          visitors: scalar(kpi, 0), visitorsPrev: scalar(kpi, 1),
          sessions: scalar(kpi, 2), sessionsPrev: scalar(kpi, 3),
          resume: scalar(kpi, 4), resumePrev: scalar(kpi, 5),
          matrix: scalar(kpi, 6), matrixPrev: scalar(kpi, 7),
          contacts: scalar(kpi, 8), contactsPrev: scalar(kpi, 9),
          links: scalar(kpi, 10), linksPrev: scalar(kpi, 11),
          returning: visitors.filter((v) => v.returning).length,
        },
        trend, funnel, referrers, recent, live, visitors, owner,
        botCount: Math.max(0, scalar(allPersons) - roster.length),
      };
    }

    cache.set(cacheKey, { t: Date.now(), data });
    if (cache.size > 50) cache.clear(); // crude bound; entries are tiny + short-lived
    return j(data);
  } catch (e) {
    return j({ error: String(e && e.message ? e.message : e) }, 502);
  }
};
