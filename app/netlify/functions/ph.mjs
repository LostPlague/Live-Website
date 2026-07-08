// Control Center backend — the ONLY place the PostHog personal key lives.
// The browser sends { password, mode, days, personId? }; we validate the
// password server-side, run fixed HogQL queries against PostHog, and return
// only results. The client can never see the key or run arbitrary SQL.
//
// Modes:
//   'overview' (default) — KPIs, charts, funnel, breakdowns, activity, and the
//                          visitor list.
//   'visitor'            — one person's full profile + chronological timeline
//                          (personId must be a UUID).
//
// Netlify env vars required: POSTHOG_PERSONAL_KEY, ADMIN_PASSWORD.

import { timingSafeEqual } from 'node:crypto';

const PH_HOST = 'https://us.i.posthog.com';
const PROJECT = '503872';
// exclude local dev noise so the dashboard only reflects real production traffic
const HF = "properties.$host NOT LIKE 'localhost%'";

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

const scalar = (rows) => (rows[0] && rows[0][0] != null ? Number(rows[0][0]) : 0);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return j({ error: 'method not allowed' }, 405);
  if (!process.env.POSTHOG_PERSONAL_KEY || !process.env.ADMIN_PASSWORD) {
    return j({ error: 'server not configured — set POSTHOG_PERSONAL_KEY and ADMIN_PASSWORD in Netlify' }, 500);
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return j({ error: 'bad request' }, 400); }
  if (!passwordOk(body.password)) return j({ error: 'unauthorized' }, 401);

  try {
    // ── single-visitor drill-down ──────────────────────────────────────────
    if (body.mode === 'visitor') {
      const pid = String(body.personId || '');
      if (!/^[0-9a-fA-F-]{36}$/.test(pid)) return j({ error: 'bad person id' }, 400);
      const [profile, timeline] = await Promise.all([
        hog(`SELECT
              any(properties.$geoip_country_name), any(properties.$geoip_city_name),
              any(properties.$geoip_subdivision_1_name), any(properties.$device_type),
              any(properties.$browser), any(properties.$os),
              any(properties.$screen_width), any(properties.$screen_height),
              any(properties.$referring_domain), any(properties.$geoip_time_zone),
              min(timestamp), max(timestamp), count(), count(DISTINCT properties.$session_id)
            FROM events WHERE person_id='${pid}'`),
        hog(`SELECT timestamp, event, properties.app, properties.stage, properties.attemptsLeft,
              properties.seconds, properties.$current_url, properties.$session_id
            FROM events WHERE person_id='${pid}' ORDER BY timestamp ASC LIMIT 500`),
      ]);
      return j({ profile: profile[0] || [], timeline });
    }

    // ── overview ───────────────────────────────────────────────────────────
    const days = [1, 7, 30, 90].includes(body.days) ? body.days : 7;
    const since = `now() - INTERVAL ${days} DAY`;
    const W = `WHERE ${HF} AND timestamp > ${since}`;

    const [
      visitors, sessions, resume, matrix, contacts, secretOpened,
      trend, geo, devices, browsers, os, referrers, appOpens, appTime,
      funnel, attempts, hours, recent, visitorList,
    ] = await Promise.all([
      hog(`SELECT count(DISTINCT person_id) FROM events ${W}`),
      hog(`SELECT count(DISTINCT properties.$session_id) FROM events ${W} AND properties.$session_id != ''`),
      hog(`SELECT count() FROM events ${W} AND event='resume_downloaded'`),
      hog(`SELECT count() FROM events ${W} AND event='secret_completed'`),
      hog(`SELECT count() FROM events ${W} AND event='contact_submitted'`),
      hog(`SELECT count() FROM events ${W} AND event='secret_opened'`),
      hog(`SELECT toDate(timestamp) d, count(DISTINCT person_id) n FROM events ${W} GROUP BY d ORDER BY d`),
      hog(`SELECT properties.$geoip_country_name c, count(DISTINCT person_id) n FROM events ${W} AND c != '' GROUP BY c ORDER BY n DESC LIMIT 8`),
      hog(`SELECT properties.$device_type t, count(DISTINCT person_id) n FROM events ${W} AND t != '' GROUP BY t ORDER BY n DESC LIMIT 5`),
      hog(`SELECT properties.$browser b, count(DISTINCT person_id) n FROM events ${W} AND b != '' GROUP BY b ORDER BY n DESC LIMIT 5`),
      hog(`SELECT properties.$os o, count(DISTINCT person_id) n FROM events ${W} AND o != '' GROUP BY o ORDER BY n DESC LIMIT 5`),
      hog(`SELECT properties.$referring_domain r, count(DISTINCT person_id) n FROM events ${W} AND r != '' AND r != '$direct' GROUP BY r ORDER BY n DESC LIMIT 6`),
      hog(`SELECT properties.app a, count() n FROM events ${W} AND event='app_opened' AND a != '' GROUP BY a ORDER BY n DESC`),
      hog(`SELECT properties.app a, round(avg(toFloat(properties.seconds))) s FROM events ${W} AND event='app_closed' AND toFloat(properties.seconds) > 0 GROUP BY a ORDER BY s DESC`),
      hog(`SELECT event, properties.stage st, count() n FROM events ${W} AND event IN ('secret_opened','secret_stage_passed','secret_completed') GROUP BY event, st`),
      hog(`SELECT properties.stage st, count() n FROM events ${W} AND event='secret_wrong_answer' GROUP BY st`),
      hog(`SELECT toHour(timestamp) h, count() n FROM events ${W} GROUP BY h ORDER BY h`),
      hog(`SELECT timestamp, event, properties.app, properties.$geoip_country_name, person_id FROM events ${W} AND event NOT LIKE '$%' ORDER BY timestamp DESC LIMIT 30`),
      hog(`SELECT person_id,
              min(timestamp) f, max(timestamp) l, count() n,
              any(properties.$geoip_country_name) c, any(properties.$geoip_city_name) city,
              any(properties.$device_type) d, any(properties.$browser) b,
              countIf(event='resume_downloaded') dl, countIf(event='secret_completed') mx,
              countIf(event='contact_submitted') ct, countIf(event='experience_started') st
            FROM events ${W} GROUP BY person_id ORDER BY f ASC LIMIT 200`),
    ]);

    return j({
      days,
      kpis: {
        visitors: scalar(visitors), sessions: scalar(sessions), resume: scalar(resume),
        matrix: scalar(matrix), contacts: scalar(contacts), secretOpened: scalar(secretOpened),
      },
      trend, geo, devices, browsers, os, referrers, appOpens, appTime,
      funnel, attempts, hours, recent, visitorList,
    });
  } catch (e) {
    return j({ error: String(e && e.message ? e.message : e) }, 502);
  }
};
