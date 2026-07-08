// Control Center backend — the ONLY place the PostHog personal key lives.
// The browser sends { password, days }; we validate the password against the
// ADMIN_PASSWORD env var (server-side), run a fixed set of HogQL queries against
// PostHog with the POSTHOG_PERSONAL_KEY env var, and return only the results.
// The client can never see the key and can never run arbitrary queries.
//
// Netlify env vars required (Site configuration → Environment variables):
//   POSTHOG_PERSONAL_KEY   (phx_… — from your local note file)
//   ADMIN_PASSWORD         (the generated password in that same file)

import { timingSafeEqual } from 'node:crypto';

const PH_HOST = 'https://us.i.posthog.com';
const PROJECT = '503872';

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
  const data = await res.json();
  return data.results || [];
}

const j = (obj, status = 200) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});

function passwordOk(given) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return j({ error: 'method not allowed' }, 405);
  if (!process.env.POSTHOG_PERSONAL_KEY || !process.env.ADMIN_PASSWORD) {
    return j({ error: 'server not configured — set POSTHOG_PERSONAL_KEY and ADMIN_PASSWORD in Netlify' }, 500);
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return j({ error: 'bad request' }, 400); }
  if (!passwordOk(body.password)) return j({ error: 'unauthorized' }, 401);

  const days = [1, 7, 30, 90].includes(body.days) ? body.days : 7;
  const since = `now() - INTERVAL ${days} DAY`;
  const scalar = (rows) => (rows[0] && rows[0][0] != null ? Number(rows[0][0]) : 0);

  try {
    const [
      visitors, sessions, resume, matrix, contacts, secretOpened,
      trend, geo, devices, browsers, referrers, appOpens, appTime,
      funnel, hours, recent, recentResume,
    ] = await Promise.all([
      hog(`SELECT count(DISTINCT person_id) FROM events WHERE timestamp > ${since}`),
      hog(`SELECT count(DISTINCT properties.$session_id) FROM events WHERE timestamp > ${since} AND properties.$session_id != ''`),
      hog(`SELECT count() FROM events WHERE event='resume_downloaded' AND timestamp > ${since}`),
      hog(`SELECT count() FROM events WHERE event='secret_completed' AND timestamp > ${since}`),
      hog(`SELECT count() FROM events WHERE event='contact_submitted' AND timestamp > ${since}`),
      hog(`SELECT count() FROM events WHERE event='secret_opened' AND timestamp > ${since}`),
      hog(`SELECT toDate(timestamp) d, count(DISTINCT person_id) n FROM events WHERE timestamp > ${since} GROUP BY d ORDER BY d`),
      hog(`SELECT properties.$geoip_country_name c, count(DISTINCT person_id) n FROM events WHERE timestamp > ${since} AND c != '' GROUP BY c ORDER BY n DESC LIMIT 8`),
      hog(`SELECT properties.$device_type t, count(DISTINCT person_id) n FROM events WHERE timestamp > ${since} AND t != '' GROUP BY t ORDER BY n DESC LIMIT 5`),
      hog(`SELECT properties.$browser b, count(DISTINCT person_id) n FROM events WHERE timestamp > ${since} AND b != '' GROUP BY b ORDER BY n DESC LIMIT 5`),
      hog(`SELECT properties.$referring_domain r, count(DISTINCT person_id) n FROM events WHERE timestamp > ${since} AND r != '' AND r != '$direct' GROUP BY r ORDER BY n DESC LIMIT 6`),
      hog(`SELECT properties.app a, count() n FROM events WHERE event='app_opened' AND timestamp > ${since} AND a != '' GROUP BY a ORDER BY n DESC`),
      hog(`SELECT properties.app a, round(avg(toFloat(properties.seconds))) s FROM events WHERE event='app_closed' AND timestamp > ${since} AND toFloat(properties.seconds) > 0 GROUP BY a ORDER BY s DESC`),
      hog(`SELECT event, properties.stage st, count() n FROM events WHERE event IN ('secret_opened','secret_stage_passed','secret_completed') AND timestamp > ${since} GROUP BY event, st`),
      hog(`SELECT toHour(timestamp) h, count() n FROM events WHERE timestamp > ${since} GROUP BY h ORDER BY h`),
      hog(`SELECT timestamp, event, properties.app, properties.$geoip_country_name FROM events WHERE event NOT LIKE '$%' AND timestamp > ${since} ORDER BY timestamp DESC LIMIT 25`),
      hog(`SELECT timestamp, properties.$geoip_city_name, properties.$geoip_country_name FROM events WHERE event='resume_downloaded' ORDER BY timestamp DESC LIMIT 12`),
    ]);

    return j({
      days,
      kpis: {
        visitors: scalar(visitors),
        sessions: scalar(sessions),
        resume: scalar(resume),
        matrix: scalar(matrix),
        contacts: scalar(contacts),
        secretOpened: scalar(secretOpened),
      },
      trend, geo, devices, browsers, referrers, appOpens, appTime,
      funnel, hours, recent, recentResume,
    });
  } catch (e) {
    return j({ error: String(e && e.message ? e.message : e) }, 502);
  }
};
