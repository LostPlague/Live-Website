// Analytics — PostHog wrapper for the whole site.
//
// Two things to know about this site's shape:
//  1. It runs the OS inside an <iframe> within the 3D room, so this module is
//     loaded in TWO documents (the room = top window, the OS = the iframe).
//     We init in both (so clicks inside the OS are captured), tag each with a
//     `surface` prop, and make the iframe adopt the room's visitor id so one
//     visit counts as ONE person, not two.
//  2. It's configured COOKIELESS (`persistence: 'memory'`) — no cookies means
//     no consent banner is required, while every event, geo/IP, and session
//     replay still work. Trade-off: returning visitors aren't linked across
//     separate visits (acceptable for the no-banner choice).
//
// The project key below is PUBLIC by design (PostHog ships it in client JS);
// it can only send events, not read data, so it's safe in the repo.

import posthog from 'posthog-js';

const KEY = 'phc_xctjb4xR6BCSwnSRKKD4EbGkQqymHFDzkZRd5DzyME3E';
const HOST = 'https://us.i.posthog.com';

let started = false;

export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const inIframe = !!window.parent && window.parent !== window;

  try {
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'memory',          // cookieless → no consent banner needed
      autocapture: true,              // every click/interaction captured for free
      capture_pageview: !inIframe,    // the room counts the visit; don't double it
      capture_pageleave: true,        // session-duration on tab close (sendBeacon)
      person_profiles: 'always',      // profile every visitor (incl. anonymous) for detail
    });

    // Expose on window: the npm module (unlike the script snippet) doesn't do
    // this, and the iframe needs to read the room's instance to unify visitors.
    (window as unknown as { posthog?: unknown }).posthog = posthog;

    // Same-origin iframe: link the OS session to the room's visitor id so the
    // whole journey is one person. Also label which surface events came from.
    posthog.register({ surface: inIframe ? 'os' : 'room' });
    if (inIframe) {
      const parentPH = (window.parent as unknown as { posthog?: { get_distinct_id?: () => string } }).posthog;
      const pid = parentPH?.get_distinct_id?.();
      if (pid) posthog.identify(pid);
    }
  } catch {
    /* never let analytics break the site */
  }
}

type Props = Record<string, unknown>;

/** Fire a custom event. Safe no-op if PostHog failed to load. */
export function track(event: string, props?: Props): void {
  try {
    posthog.capture(event, props);
  } catch {
    /* ignore */
  }
}

// ── app open/close timing ───────────────────────────────────────────────────
// Records how long each OS app stayed open (open → close, in seconds).
const openedAt: Record<string, number> = {};

export function trackAppOpen(app: string): void {
  openedAt[app] = Date.now();
  track('app_opened', { app });
}

export function trackAppClose(app: string): void {
  const t0 = openedAt[app];
  const seconds = t0 ? Math.round((Date.now() - t0) / 1000) : undefined;
  delete openedAt[app];
  track('app_closed', { app, seconds });
}

/** Flush open-app durations if the tab is closed with apps still open. */
export function flushOpenApps(): void {
  for (const app of Object.keys(openedAt)) trackAppClose(app);
}

export { posthog };
