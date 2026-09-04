// HTTP trigger for the alert pipeline, behind the admin password. Exists
// because Netlify refuses HTTP access to scheduled functions, which would
// otherwise leave the alerting impossible to verify until the day it silently
// failed to tell you about a real download.
//
//   { password, dryRun: true } — report what WOULD be sent, mail nothing
//   { password, test: true }   — send one labelled test email
//   { password }               — run for real, exactly as the cron does
//
// POST only, so it can't be triggered by following a link.

import { runAlerts, passwordOk } from '../lib/alerts-core.mjs';

const j = (obj, status = 200) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return j({ error: 'method not allowed' }, 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return j({ error: 'bad request' }, 400); }
  if (!passwordOk(body.password)) return j({ error: 'unauthorized' }, 401);

  try {
    return j(await runAlerts({ dryRun: body.dryRun === true, test: body.test === true }));
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    console.error('[alerts-run] failed:', msg);
    return j({ error: msg }, 502);
  }
};
