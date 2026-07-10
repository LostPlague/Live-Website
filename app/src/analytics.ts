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
// Measurement philosophy (Phase 2): everything meaningful is measured, but
// summarized — thresholds instead of firehoses. Hovers only count past 600ms,
// the 3D-room journey compresses into ONE summary event per visit, FPS is a
// single sample, and every unload-time emission rides sendBeacon.
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
      rageclick: true,                // $rageclick on 3 fast clicks in one spot (frustration)
      // dead clicks = clicks that visibly did nothing (option shipped after our
      // pinned posthog-js types; harmless no-op if the runtime predates it)
      ...({ capture_dead_clicks: true } as unknown as Record<string, never>),
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

    // JS errors — the site should never fail silently in production. Capped at
    // 5 per page so a render-loop error can't flood the event stream.
    let errCount = 0;
    window.addEventListener('error', (e) => {
      if (errCount++ < 5) track('js_error', { message: String(e.message || 'unknown').slice(0, 180), source: String(e.filename || '').split('/').pop() || 'inline' });
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = (e as PromiseRejectionEvent).reason as { message?: string } | string | undefined;
      const msg = typeof r === 'object' && r?.message ? r.message : String(r ?? 'unknown');
      if (errCount++ < 5) track('js_error', { message: msg.slice(0, 180), source: 'promise' });
    });

    // Exit flush: every dwell timer (open apps, active section, room journey)
    // must survive tab close. Regular capture transport gets killed mid-flight
    // on unload — that silently lost ~90% of app_closed events in v2 — so all
    // of these ride sendBeacon.
    window.addEventListener('pagehide', () => {
      flushOpenApps(true);
      flushSection(true);
      flushRoom(true);
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

// ── app open/close timing + focus accounting ────────────────────────────────
// open→close = how long the window existed; focus = how long it was the TOP
// non-minimized window (the honest "actually looking at it" number).
const openedAt: Record<string, number> = {};
const focusMs: Record<string, number> = {};
const minimizeCounts: Record<string, number> = {};
let focusCur: string | null = null;
let focusT0 = 0;

/** OS reports which app is on top (null = none). Accumulates focused time. */
export function trackAppFocus(app: string | null): void {
  const now = Date.now();
  if (focusCur) focusMs[focusCur] = (focusMs[focusCur] || 0) + (now - focusT0);
  focusCur = app;
  focusT0 = now;
}

export function trackAppMinimize(app: string): void {
  minimizeCounts[app] = (minimizeCounts[app] || 0) + 1;
}

export function trackAppOpen(app: string): void {
  if (openedAt[app]) return; // idempotent: an app can't open twice without closing
  openedAt[app] = Date.now();
  track('app_opened', { app });
}

export function trackAppClose(app: string, beacon = false): void {
  if (!(app in openedAt)) return; // idempotent: no phantom closes
  if (focusCur === app) trackAppFocus(null); // close out a live focus interval
  const t0 = openedAt[app];
  const seconds = t0 ? Math.round((Date.now() - t0) / 1000) : undefined;
  const focusedSeconds = focusMs[app] != null ? Math.round(focusMs[app] / 1000) : undefined;
  const minimizes = minimizeCounts[app] || undefined;
  delete openedAt[app];
  delete focusMs[app];
  delete minimizeCounts[app];
  track('app_closed', { app, seconds, focusedSeconds, minimizes }, beacon);
}

/** Flush open-app durations if the tab is closed with apps still open. */
export function flushOpenApps(beacon = false): void {
  for (const app of Object.keys(openedAt)) trackAppClose(app, beacon);
}

// ── showcase section timing + scroll depth ──────────────────────────────────
// The showcase pages are routes (/os → home, /os/about, /os/experience,
// /os/contact). One section is "active" at a time; on section change, window
// close, or tab close we emit how long it was read and how far it was scrolled.
let section: { name: string; t0: number; scroll: number } | null = null;

export function trackSectionEnter(name: string): void {
  if (section?.name === name) return;
  flushSection();
  section = { name, t0: Date.now(), scroll: 0 };
}

/** Highest scroll position reached in the active section (0–100). */
export function updateSectionScroll(pct: number): void {
  if (section && pct > section.scroll) section.scroll = Math.min(100, pct);
}

export function flushSection(beacon = false): void {
  if (!section) return;
  const seconds = Math.round((Date.now() - section.t0) / 1000);
  const { name, scroll } = section;
  section = null;
  track('section_viewed', { section: name, seconds, scrollPct: scroll || undefined }, beacon);
}

// ── element hover ("hesitation") tracking ───────────────────────────────────
// Only meaningful targets are instrumented (resume link, contact send, desktop
// icons, start button…). A hover counts once it passes 600ms — intent, not a
// mouse passing by — and each target emits at most 3 times per page.
const hovers: Record<string, { t0: number | null; acc: number; emits: number }> = {};

export function hoverHandlers(target: string): { onMouseEnter: () => void; onMouseLeave: () => void } {
  return {
    onMouseEnter: () => {
      const h = (hovers[target] ||= { t0: null, acc: 0, emits: 0 });
      h.t0 = Date.now();
    },
    onMouseLeave: () => {
      const h = hovers[target];
      if (!h || h.t0 == null) return;
      h.acc += Date.now() - h.t0;
      h.t0 = null;
      if (h.acc >= 600 && h.emits < 3) {
        h.emits += 1;
        track('element_hovered', { target, seconds: Math.round(h.acc / 100) / 10 });
        h.acc = 0;
      }
    },
  };
}

// ── 3D room journey ─────────────────────────────────────────────────────────
// The room's behavior compresses into ONE event per visit:
//  · experience_abandoned {seconds}  — loaded the intro, never clicked Start
//  · room_summary {…}                — time per camera view (wide/desk/monitor/
//    orbit), orbit entries, view transitions, AFK time, and a "played" verdict.
const room = {
  active: false, started: false, mountT: 0,
  cur: null as string | null, curT0: 0,
  ms: {} as Record<string, number>,
  orbits: 0, transitions: 0, afkMs: 0, lastInput: 0,
};

const roomInput = (): void => {
  const now = Date.now();
  const gap = now - room.lastInput;
  if (gap > 30_000) room.afkMs += gap; // >30s without input = away from keyboard
  room.lastInput = now;
};

/** Call once when the 3D experience mounts (room surface only). */
export function roomMount(): void {
  if (room.active) return;
  room.active = true;
  room.mountT = Date.now();
  room.lastInput = Date.now();
  for (const ev of ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const) {
    window.addEventListener(ev, roomInput, { passive: true });
  }
}

export function roomStarted(): void {
  room.started = true;
}

/** Camera state machine hook — every view change flows through here. */
export function roomStateChange(state: string): void {
  const now = Date.now();
  if (room.cur) {
    room.ms[room.cur] = (room.ms[room.cur] || 0) + (now - room.curT0);
    room.transitions += 1;
  }
  if (state === 'orbit') room.orbits += 1;
  room.cur = state === 'loading' ? null : state;
  room.curT0 = now;
}

export function flushRoom(beacon = false): void {
  if (!room.active) return;
  room.active = false; // one summary per page-life
  if (!room.started) {
    track('experience_abandoned', { seconds: Math.round((Date.now() - room.mountT) / 1000) }, beacon);
    return;
  }
  roomInput(); // close out a trailing AFK gap
  if (room.cur) room.ms[room.cur] = (room.ms[room.cur] || 0) + (Date.now() - room.curT0);
  const s = (k: string) => Math.round((room.ms[k] || 0) / 1000);
  track('room_summary', {
    wideSeconds: s('idle'), deskSeconds: s('desk'), monitorSeconds: s('monitor'), orbitSeconds: s('orbit'),
    afkSeconds: Math.round(room.afkMs / 1000),
    orbitCount: room.orbits, transitions: room.transitions,
    played: room.orbits > 0 || room.transitions >= 3,
  }, beacon);
}

export { posthog };
