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
//     The tag is resolved BEFORE PostHog is touched and stored in BOTH
//     localStorage and a 1-year first-party cookie — see `resolveOwner()` for
//     why both, and why the ordering is load-bearing rather than stylistic.
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
const OWNER_KEY = 'cc_owner';
const OWNER_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

let started = false;

// The tag is mirrored into a first-party cookie as well as localStorage. Either
// one alone is fragile: "Clear site data" wipes localStorage, and some privacy
// settings expire script-written storage on a short clock. Reads accept either
// store; writes always set both, so a purge of one survives in the other.
function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/** Visible confirmation that the tag took. Without this, a failed tag is
 *  indistinguishable from a successful one and you find out weeks later, in the
 *  dashboard, as "Visitor 014". Plain DOM — it must work before React mounts
 *  and on /admin, where React owns a different tree entirely. */
function ownerToast(on: boolean): void {
  try {
    const paint = () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.textContent = on
        ? '●  Owner mode ON — your visits are excluded from stats'
        : '○  Owner mode OFF — you are counted as a normal visitor';
      el.style.cssText = [
        'position:fixed', 'top:18px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:2147483647', 'padding:10px 18px', 'border-radius:999px',
        'font:600 13px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif',
        'letter-spacing:0.01em', 'white-space:nowrap',
        `color:${on ? '#eaf2ff' : '#8ba3c7'}`,
        'background:rgba(11,22,38,0.92)',
        `border:1px solid ${on ? 'rgba(56,189,248,0.45)' : 'rgba(56,189,248,0.18)'}`,
        'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
        'opacity:0', 'transition:opacity 200ms cubic-bezier(0.23,1,0.32,1)',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; });
      window.setTimeout(() => {
        el.style.opacity = '0';
        window.setTimeout(() => el.remove(), 250);
      }, 4000);
    };
    if (document.body) paint();
    else window.addEventListener('DOMContentLoaded', paint, { once: true });
  } catch {
    /* a missing toast must never cost us the tag */
  }
}

/**
 * Resolve and PERSIST the owner preference. Deliberately free of any PostHog
 * call, and called before `posthog.init` — this used to live after it, inside
 * the same try block, which meant a blocked or failed posthog-js swallowed the
 * write and the tag never persisted at all. On the owner's own machine (where
 * ad-blockers are most likely) that failure mode was permanent and silent.
 *
 * Safe to call on /admin, where analytics never initializes, so `/admin?me=…`
 * tags the browser without turning tracking on for the dashboard.
 *
 * @returns whether this browser is currently tagged as the owner.
 */
export function resolveOwner(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const me = params.get('me');

    if (me === OWNER_TOKEN) {
      localStorage.setItem(OWNER_KEY, '1');
      writeCookie(OWNER_KEY, '1', OWNER_MAX_AGE);
    } else if (me === 'off') {
      localStorage.removeItem(OWNER_KEY);
      writeCookie(OWNER_KEY, '', 0);
    }

    // Strip ?me= so the token never sits in the address bar, gets bookmarked,
    // or rides along in a shared link.
    if (me !== null) {
      params.delete('me');
      const q = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (q ? '?' + q : ''));
    }

    const tagged = localStorage.getItem(OWNER_KEY) === '1' || readCookie(OWNER_KEY) === '1';

    // Heal a half-present tag: whichever store survived re-seeds the other.
    if (tagged) {
      try { localStorage.setItem(OWNER_KEY, '1'); } catch { /* storage may be full/blocked */ }
      writeCookie(OWNER_KEY, '1', OWNER_MAX_AGE);
    }

    if (me !== null) ownerToast(tagged);
    // Always answerable from devtools, on any page, without touching the dashboard.
    console.info(`[analytics] owner mode: ${tagged ? 'ON' : 'off'}`);
    return tagged;
  } catch {
    return false;
  }
}

export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Resolved FIRST, and outside the try below: persisting the owner tag must
  // never depend on PostHog loading successfully.
  const isOwner = resolveOwner();

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

    // Untag must actually untag. PostHog keeps super properties and the
    // identity in its OWN storage bucket, which clearing `cc_owner` does not
    // touch — so without this, `?me=off` left the browser stamping
    // `is_owner: true` and identifying as "owner" forever. Runs before any
    // register() below, since reset() wipes super properties.
    const staleOwner =
      posthog.get_distinct_id?.() === 'owner' || posthog.get_property?.('is_owner') === true;
    if (!isOwner && staleOwner) posthog.reset(); // fresh anonymous id, flag dropped

    posthog.register({ surface: inIframe ? 'os' : 'room' });
    if (inIframe) {
      const parentPH = (window.parent as unknown as { posthog?: { get_distinct_id?: () => string } }).posthog;
      const pid = parentPH?.get_distinct_id?.();
      if (pid) posthog.identify(pid);
    }

    // After identify-adoption so the owner identity wins over the parent's.
    if (isOwner) {
      posthog.register({ is_owner: true }); // stamped on every event from here on
      posthog.identify('owner');            // one person across all owner devices
    }

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
