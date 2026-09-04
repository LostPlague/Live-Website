// Resume-download alerts — email Med when someone takes his CV.
//
// Runs on a schedule (see netlify.toml). Zero dependencies: it queries PostHog
// with the key already in the env and hands the email to FormSubmit, the same
// service the contact form already uses for this address.
//
// WINDOW / LAG — the one subtle part. PostHog events are not queryable the
// instant they are captured; ingest (capture -> Kafka -> ClickHouse) runs
// 1-3 minutes behind. So each run covers [now-20m, now-5m]:
//   · the 5-minute trailing buffer lets ingest settle, so we never read a
//     window that is still filling,
//   · the window is exactly as wide as the schedule interval (15m), so
//     consecutive runs tile with no overlap and no gap.
// Overlapping would double-send; a window flush with "now" would silently drop
// downloads that had not landed yet. Change the schedule and this must change
// with it — they are one setting in two places.
//
// Env: POSTHOG_PERSONAL_KEY (query), ADMIN_PASSWORD (manual/dry-run trigger),
// ALERT_EMAIL (optional override, defaults to Med's inbox).

import { timingSafeEqual } from 'node:crypto';

const PH_HOST = 'https://us.i.posthog.com';
const PROJECT = '503872';
const TO = process.env.ALERT_EMAIL || 'mohameddtabari@gmail.com';

const LOOKBACK_MIN = 20; // window start:  now - 20m
const SETTLE_MIN = 5;    // window end:    now - 5m   (ingest buffer)

// Same production-only guard the dashboard uses.
const BASE =
  `properties.$host NOT LIKE 'localhost%' AND properties.$host NOT LIKE '%.netlify.app%'` +
  ` AND event != '__verify_test__'`;

const OWNER = `(countIf(properties.is_owner = true) > 0 OR countIf(distinct_id = 'owner') > 0)`;

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

/** Downloads in the settled window, owner excluded, newest first. */
async function recentDownloads() {
  return hog(`
    SELECT timestamp,
           properties.$geoip_city_name, properties.$geoip_country_name,
           properties.ref, properties.$device_type, properties.$browser,
           properties.$referring_domain, person_id
    FROM events
    WHERE ${BASE}
      AND event = 'resume_downloaded'
      AND timestamp >  now() - INTERVAL ${LOOKBACK_MIN} MINUTE
      AND timestamp <= now() - INTERVAL ${SETTLE_MIN} MINUTE
      AND person_id NOT IN (
        SELECT person_id FROM events WHERE ${BASE} GROUP BY person_id HAVING ${OWNER}
      )
    ORDER BY timestamp DESC
    LIMIT 20`);
}

const val = (v) => (v == null || v === '' ? null : String(v));

function describe(r) {
  const [ts, city, country, ref, device, browser, referrer] = r;
  const where = [val(city), val(country)].filter(Boolean).join(', ') || 'location unknown';
  const application = val(ref);
  const lines = [
    application
      ? `APPLICATION: ${application}`
      : `APPLICATION: — (untagged link, so this one can't be traced to an application)`,
    `Where:   ${where}`,
    `Device:  ${[val(device), val(browser)].filter(Boolean).join(' · ') || 'unknown'}`,
    `Came in: ${val(referrer) && val(referrer) !== '$direct' ? val(referrer) : 'direct'}`,
    `When:    ${val(ts)} UTC`,
  ];
  return lines.join('\n');
}

async function sendEmail(subject, body) {
  // FormSubmit needs no key and is already activated for this address by the
  // contact form. If it ever starts refusing server-side posts, this throws and
  // the scheduled run logs it rather than failing silently.
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(TO)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: 'mohamedtabari.com',
      email: TO,
      _subject: subject,
      message: body,
    }),
  });
  const raw = await res.json().catch(() => ({}));
  const ok = raw.success === true || raw.success === 'true';
  if (!ok) throw new Error(`formsubmit refused: ${JSON.stringify(raw).slice(0, 200)}`);
  return true;
}

function passwordOk(given) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  try { return timingSafeEqual(Buffer.from(given), Buffer.from(expected)); } catch { return false; }
}

const j = (obj, status = 200) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (!process.env.POSTHOG_PERSONAL_KEY) {
    return j({ error: 'server not configured — set POSTHOG_PERSONAL_KEY in Netlify' }, 500);
  }

  // Manual trigger, for verifying this without waiting for the cron.
  // { password, dryRun: true } reports what WOULD be sent and emails nothing.
  // { password, test: true }   sends one obviously-labelled test email.
  let manual = null;
  if (event && event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return j({ error: 'bad request' }, 400); }
    if (!passwordOk(body.password)) return j({ error: 'unauthorized' }, 401);
    manual = body;
  }

  try {
    if (manual && manual.test) {
      await sendEmail(
        'Test — resume alerts are working',
        'This is a test from mohamedtabari.com.\n\nIf you are reading this, resume-download alerts can reach your inbox.',
      );
      return j({ sent: 'test email', to: TO });
    }

    const rows = await recentDownloads();

    if (manual && manual.dryRun) {
      return j({
        dryRun: true,
        window: `[now-${LOOKBACK_MIN}m, now-${SETTLE_MIN}m]`,
        found: rows.length,
        preview: rows.map(describe),
      });
    }

    if (!rows.length) return j({ ok: true, found: 0 });

    const subject = rows.length === 1
      ? `Resume downloaded${val(rows[0][3]) ? ` — ${val(rows[0][3])}` : ''}`
      : `${rows.length} resume downloads`;

    const body = [
      rows.length === 1
        ? 'Someone downloaded your resume.'
        : `${rows.length} people downloaded your resume.`,
      '',
      rows.map(describe).join('\n\n---\n\n'),
      '',
      'Full detail: https://mohamedtabari.com/admin',
    ].join('\n');

    await sendEmail(subject, body);
    return j({ ok: true, found: rows.length, emailed: true });
  } catch (e) {
    // Surfaced in the Netlify function log rather than swallowed — a silent
    // alerting system is worse than none, because it is trusted.
    const msg = String(e && e.message ? e.message : e);
    console.error('[alerts] failed:', msg);
    return j({ error: msg }, 502);
  }
};
