// Analytics — PostHog wrapper for the whole site.
//
// Three things to know about this site's shape:
//  1. It runs the OS inside a same-origin <iframe> (/os) within the 3D room, so
//     this module loads in TWO documents. Both share localStorage, so they get
//     the SAME visitor id automatically; we still adopt the parent id as a
//     belt-and-suspenders merge and tag each doc with a `surface` prop.
//  2. Persistence is `localStorage` — a first-party id kept in the browser so a
//     RETURNING visitor is the SAME person across visits (this is what makes
//     "Visitor 002 came back" possible in the Control Center). It is NOT a
//     consent-banner cookie: first-party only, no cross-site tracking, no popup.
//  3. The owner (Med) self-tags a browser by opening the site once with
//     `/?me=<OWNER_TOKEN>`. That browser then stamps `is_owner` on every event
//     and identifies as the single stable "owner" person, so his own visits
//     never pollute visitor stats. `/?me=off` untags.
//
// The project key is PUBLIC by design (PostHog ships it in client JS); it can
// only send events, not read data. The owner token is not a secret either —
// the worst anyone can do with it is hide their OWN traffic from the stats.

import posthog from 'posthog-js';

const KEY = 'phc_xctjb4xR6BCSwnSRKKD4EbGkQqymHFDzkZRd5DzyME3E';
const HOST = 'https://us.i.posthog.com';
const OWNER_TOKEN = 'k9Xm2Q7p';

let started = false;

/** Tag/untag this browser as the owner via ?me=<token> / ?me=off, then strip
 *  the param from the address bar. Runs in both documents (shared storage). */
function applyOwner(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const me = params.get('me');
    if (me === OWNER_TOKEN) localStorage.setItem('cc_owner', '1');
    else if (me === 'off') localStorage.removeItem('cc_owner');
    if (me !== null) {
      params.delete('me');
      const q = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (q ? '?' + q : ''));
    }
    if (localStorage.getItem('cc_owner') === '1') {
      posthog.register({ is_owner: true }); // stamped on every event from here on
      posthog.identify('owner');            // one person across all owner devices
    }
  } catch {
    /* ignore */
  }
}

export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const inIframe = !!window.parent && window.parent !== window;

  try {
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'localStorage',    // first-party id → returning visitors recognised, still no banner
      autocapture: true,              // every click/interaction captured for free
      capture_pageview: !inIframe,    // the room counts the visit; don't double it
      capture_pageleave: true,        // session-duration on tab close (sendBeacon)
      person_profiles: 'always',      // profile every visitor (incl. anonymous) for detail
    });

    // Expose on window: the npm module (unlike the script snippet) doesn't do
    // this, and the iframe reads the room's instance to unify visitors.
    (window as unknown as { posthog?: unknown }).posthog = posthog;

    posthog.register({ surface: inIframe ? 'os' : 'room' });
    if (inIframe) {
      const parentPH = (window.parent as unknown as { posthog?: { get_distinct_id?: () => string } }).posthog;
      const pid = parentPH?.get_distinct_id?.();
      if (pid) posthog.identify(pid);
    }

    applyOwner(); // after identify-adoption so the owner identity wins

    // Exit flush: dwell timers (open apps, active section) must survive tab
    // close. Regular capture transport gets killed mid-flight on unload — that
    // silently lost ~90% of app_closed events in v2 — so flush via sendBeacon.
    window.addEventListener('pagehide', () => {
      flushOpenApps(true);
      flushSection(true);
    });
  } catch {
    /* never let analytics break the site */
  }
}

type Props = Record<string, unknown>;

/** Fire a custom event. Safe no-op if PostHog failed to load.
 *  `beacon` forces sendBeacon transport — use for unload-time events. */
export function track(event: string, props?: Props, beacon = false): void {
  try {
    posthog.capture(event, props, beacon ? { transport: 'sendBeacon' } : undefined);
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

export function trackAppClose(app: string, beacon = false): void {
  const t0 = openedAt[app];
  const seconds = t0 ? Math.round((Date.now() - t0) / 1000) : undefined;
  delete openedAt[app];
  track('app_closed', { app, seconds }, beacon);
}

/** Flush open-app durations if the tab is closed with apps still open. */
export function flushOpenApps(beacon = false): void {
  for (const app of Object.keys(openedAt)) trackAppClose(app, beacon);
}

// ── showcase section timing ─────────────────────────────────────────────────
// The showcase pages are routes (/os → home, /os/about, /os/experience,
// /os/contact). One section is "active" at a time; on section change, window
// close, or tab close we emit how long it was read.
let section: { name: string; t0: number } | null = null;

export function trackSectionEnter(name: string): void {
  if (section?.name === name) return;
  flushSection();
  section = { name, t0: Date.now() };
}

export function flushSection(beacon = false): void {
  if (!section) return;
  const seconds = Math.round((Date.now() - section.t0) / 1000);
  const name = section.name;
  section = null;
  track('section_viewed', { section: name, seconds }, beacon);
}

export { posthog };
