// Scheduled runner for resume-download alerts. Netlify invokes this on the
// cron in netlify.toml; it cannot be reached over HTTP (Netlify refuses that
// for scheduled functions). All the logic lives in ../lib/alerts-core.mjs so
// the same code path can be exercised on demand via alerts-run.mjs.

import { runAlerts } from '../lib/alerts-core.mjs';

export const handler = async () => {
  try {
    const result = await runAlerts();
    console.log('[alerts] scheduled run:', JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    // Logged loudly, never swallowed: an alerting system that fails quietly is
    // worse than none, because it still gets trusted.
    console.error('[alerts] scheduled run FAILED:', String(e && e.message ? e.message : e));
    return { statusCode: 502, body: JSON.stringify({ error: String(e && e.message ? e.message : e) }) };
  }
};
