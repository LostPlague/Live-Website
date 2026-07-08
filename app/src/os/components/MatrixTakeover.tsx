import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  playPowerDown,
  startGlitchStatic,
  startMatrixDrone,
  startMatrixMusic,
  startMatrixFinale,
  playFinaleRiser,
  playCountdownTick,
  playGlassBreak,
  preloadGlassBreak,
  BREAK_HIT2,
  playReenterZap,
} from './matrixAudio';
import { track } from '../../analytics';

// Full-OS Matrix takeover — STAGE 2 and the gateway to STAGE 3.
// Phases (driven by OS.tsx):
//   glitch — an SVG displacement filter shreds the LIVE desktop.
//   matrix — black screen, digital rain, typed message.
//   exit   — CRT scanline collapse while the desktop glitches back in.
// Levels:
//   2 — the OS has fallen but the room outside is fine. The screen types a
//       comment on the Turing answer, then asks the FINAL question (tokens).
//       Music: the stage-2 synth score + drone.
//   3 — final clearance. Posts 'matrixFinale' to the 3D shell (the room
//       digitizes, the Admin hologram appears). Music: riser fired at the
//       unlock click, then the darker finale score.
// The OS tree never unmounts, so every window survives the trip.

export type MatrixPhase = 'glitch' | 'matrix' | 'exit';

const GLITCH_MS = 2300;

const L2_LINES = [
  '> CLEARANCE 2 GRANTED',
  '> The Turing test. Machines passing as humans.',
  "> Funny — in here, it's the humans who prove themselves.",
  '> This desktop has stopped pretending.',
  '>',
  '> THE FINAL STAGE IS LOCKED. One question remains:',
  '> What is the most valuable resource in the AI world?',
];

// The Admin's address — fills the OS screen in big type while the shell
// speaks it line by line (each spoken line drives the typing via postMessage).
// Lines kept short so nothing wraps at 48px on the 1280px screen.
const L3_LINES = [
  'WELCOME BACK, OPERATOR.',
  'You have reached the final level.',
  '',
  'Dreams sold as truth.',
  'Machines that pass as human.',
  'And the currency every thought',
  'is paid for in.',
  '',
  'Three gates. Three answers.',
  'No wrong turns.',
  '',
  'Every agent, every answer,',
  'every world like this one —',
  'all of it runs on tokens.',
  '',
  'Spend yours on things worth building.',
  '',
  '— M.T. // ADMIN',
];

const A3 = /tokens?/i;

const RAIN_GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789$+*#';

const GLITCH_FLASHES = [
  { at: 480, dur: 120, text: 'SIGNAL INTERCEPTED' },
  { at: 1080, dur: 140, text: 'REALITY INTEGRITY FAULT' },
  { at: 1750, dur: 180, text: 'THIS DESKTOP IS NOT REAL' },
];

export interface MatrixTakeoverProps {
  phase: MatrixPhase;
  /** 2 = OS only; 3 = the whole site/room falls */
  level: 2 | 3;
  /** the wrapper around the entire normal OS UI — this is what gets shredded */
  subjectRef: React.RefObject<HTMLDivElement | null>;
  onReenter: () => void;
  /** correct final answer → OS.tsx raises level to 3 */
  onFinalUnlock: () => void;
}

/** Full-viewport digital rain (same falling-glyph effect, sized to the screen). */
const MatrixRainFull: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const fontSize = 17;
    let drops: number[] = [];

    const fit = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const columns = Math.ceil(canvas.width / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.floor(Math.random() * -60));
    };
    fit();
    window.addEventListener('resize', fit);

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 45) return; // era-appropriate chunkiness
      last = t;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const glyph = RAIN_GLYPHS[Math.floor(Math.random() * RAIN_GLYPHS.length)];
        const y = drops[i] * fontSize;
        ctx.fillStyle = '#c8ffc8'; // bright head
        ctx.fillText(glyph, i * fontSize, y);
        ctx.fillStyle = '#00ff41'; // green trail refresh
        ctx.fillText(glyph, i * fontSize, y - fontSize);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, []);

  return <canvas ref={canvasRef} className="mtx-rain" />;
};

/**
 * The green vortex — after the break, the single way back to the simulation.
 * Three spiral arms of glowing particles drawn as motion streaks (fade-
 * instead-of-clear + additive compositing) accelerating into a pulsing white-
 * green core, with a few comet runners. No ring. The canvas slow-rotates in
 * CSS for extra depth.
 */
const VortexPortal: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const S = canvas.width;
    const c = S / 2;
    const ARMS = 3;
    const parts = new Array(380).fill(0).map(() => {
      const arm = (Math.random() * ARMS) | 0;
      return {
        a: (arm / ARMS) * Math.PI * 2 + Math.random() * 0.9, // clustered per arm
        r: 24 + Math.random() * (c - 30),
        s: 0.6 + Math.random() * 1.4,
        comet: Math.random() < 0.06, // a few bright white runners
      };
    });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S); // opaque base so trails can fade
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      // motion trails: fade the last frame instead of clearing it
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(0, 0, S, S);
      ctx.globalCompositeOperation = 'lighter';
      const t = performance.now() * 0.001;
      // pulsing core
      const pulse = 16 + Math.sin(t * 2.2) * 5;
      const grad = ctx.createRadialGradient(c, c, 0, c, c, pulse * 4);
      grad.addColorStop(0, 'rgba(210, 255, 228, 1)');
      grad.addColorStop(0.35, 'rgba(0, 255, 65, 0.5)');
      grad.addColorStop(1, 'rgba(0, 255, 65, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c, c, pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      // spiral arms: glowing STREAKS accelerating into the throat
      for (const p of parts) {
        const px = c + Math.cos(p.a) * p.r;
        const py = c + Math.sin(p.a) * p.r * 0.9;
        p.a += (0.02 + (c - p.r) * 0.00085) * p.s;
        p.r -= (0.5 + (c - p.r) * 0.004) * p.s; // faster as it falls in
        if (p.r < 10) {
          p.r = c - 24 + Math.random() * 12;
          p.comet = Math.random() < 0.06;
        }
        const x = c + Math.cos(p.a) * p.r;
        const y = c + Math.sin(p.a) * p.r * 0.9;
        const b = 1 - p.r / c;
        ctx.strokeStyle = p.comet
          ? `rgba(235, 255, 245, ${(0.5 + b * 0.5).toFixed(2)})`
          : `rgba(${(50 + b * 170) | 0}, 255, ${(100 + b * 140) | 0}, ${(0.16 + b * 0.7).toFixed(2)})`;
        ctx.lineWidth = p.comet ? 2.6 : 1 + b * 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mtx-vortex-wrap" onMouseDown={onEnter}>
      <canvas ref={ref} width={560} height={560} className="mtx-vortex" />
      <p className="mtx-vortex-hint">[ THE WAY BACK ]</p>
    </div>
  );
};

// ── fracture geometry ──────────────────────────────────────────────────────
// ONE seeded web feeds both the drawn cracks and the shard cut, so the glass
// breaks into exactly the pieces the cracks outlined — no grid anywhere.

type Pt = { x: number; y: number };

interface FractureWeb {
  impact: Pt;
  mains: Pt[][];                              // MAINS radials × RF.length pts
  branches: Pt[][];
  ringSegs: { pts: Pt[]; band: number }[];    // jagged arcs between mains
  shards: { poly: Pt[]; centroid: Pt; band: number }[];
  glints: { p: Pt; band: number; seed: number }[];
  deadPx: { x: number; y: number; w: number; h: number }[];
  lcdCols: number[];
  W: number;
  H: number;
}

const RF = [0, 0.055, 0.115, 0.2, 0.31, 0.45, 0.63, 0.86, 1.18]; // ring radii
const MAINS = 17;

function buildWeb(W: number, H: number): FractureWeb {
  const impact = { x: W * (0.44 + Math.random() * 0.12), y: H * (0.4 + Math.random() * 0.18) };
  const maxR = Math.hypot(Math.max(impact.x, W - impact.x), Math.max(impact.y, H - impact.y)) * 1.02;

  const mains: Pt[][] = [];
  for (let m = 0; m < MAINS; m++) {
    // heavy angular jitter so spokes CLUSTER unevenly — real glass never
    // fractures into equal slices
    const base = (m / MAINS) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const pts: Pt[] = [];
    let a = base;
    for (let k = 0; k < RF.length; k++) {
      if (k > 0) a += (Math.random() - 0.5) * 0.26; // the crack wanders
      const r = RF[k] * maxR * (0.92 + Math.random() * 0.16);
      pts.push({ x: impact.x + Math.cos(a) * r, y: impact.y + Math.sin(a) * r });
    }
    mains.push(pts);
  }

  const branches: Pt[][] = [];
  for (let m = 0; m < MAINS; m++) {
    const n = 2 + ((Math.random() * 3) | 0);
    for (let b = 0; b < n; b++) {
      const k = 2 + ((Math.random() * 5) | 0);
      const start = mains[m][k];
      let a = Math.atan2(start.y - impact.y, start.x - impact.x)
        + (Math.random() < 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.55);
      const bp: Pt[] = [start];
      const segs = 2 + ((Math.random() * 3) | 0);
      for (let s = 0; s < segs; s++) {
        a += (Math.random() - 0.5) * 0.34;
        const prev = bp[bp.length - 1];
        // outer forks run longer — they fill the corners with hairlines
        const step = (24 + Math.random() * 46) * (k >= 5 ? 1.8 : 1);
        bp.push({ x: prev.x + Math.cos(a) * step, y: prev.y + Math.sin(a) * step });
      }
      branches.push(bp);
    }
  }

  // rings are PARTIAL — segments randomly missing, radii wobbling — so the
  // web never reads as a neat dartboard
  const ringSegs: { pts: Pt[]; band: number }[] = [];
  for (let k = 2; k < RF.length - 1; k++) {
    for (let m = 0; m < MAINS; m++) {
      if (Math.random() < 0.42) continue;
      const p1 = mains[m][k];
      const p2 = mains[(m + 1) % MAINS][k];
      const mid = {
        x: (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 38,
        y: (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 38,
      };
      ringSegs.push({ pts: [p1, mid, p2], band: k });
    }
  }

  // shards: 8 double-sectors × 4 bands, corners ON the crack lines
  const shards: FractureWeb['shards'] = [];
  const BANDS: [number, number][] = [[0, 2], [2, 4], [4, 6], [6, 8]];
  for (let m = 0; m < MAINS; m += 2) {
    const mA = mains[m];
    const mB = mains[(m + 1) % MAINS];
    const mC = mains[(m + 2) % MAINS];
    for (let bi = 0; bi < BANDS.length; bi++) {
      const [k0, k1] = BANDS[bi];
      const poly = k0 === 0
        ? [impact, mC[k1], mB[k1], mA[k1]]
        : [mA[k0], mB[k0], mC[k0], mC[k1], mB[k1], mA[k1]];
      const centroid = {
        x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
        y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
      };
      shards.push({ poly, centroid, band: bi });
    }
  }

  // refraction glints on random crack nodes
  const glints: FractureWeb['glints'] = [];
  for (let i = 0; i < 26; i++) {
    const m = (Math.random() * MAINS) | 0;
    const k = 2 + ((Math.random() * (RF.length - 3)) | 0);
    glints.push({ p: mains[m][k], band: k, seed: Math.random() * 10 });
  }

  // dead-pixel blotches near the impact + busted LCD columns
  const deadPx = Array.from({ length: 9 }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * maxR * 0.16;
    return {
      x: impact.x + Math.cos(a) * r,
      y: impact.y + Math.sin(a) * r,
      w: 3 + Math.random() * 14,
      h: 2 + Math.random() * 9,
    };
  });
  const lcdCols = [impact.x + (Math.random() - 0.5) * 60, impact.x + (Math.random() - 0.5) * 140];

  return { impact, mains, branches, ringSegs, shards, glints, deadPx, lcdCols, W, H };
}

/**
 * The OS breaks — in TWO stages, like real tempered glass:
 *   impact  (t=0)    a micro-web punches out around the strike point;
 *   burst   (t≈360)  the catastrophic spread: the full web races to the
 *                    edges with chromatic ghosting, glints, dead pixels and
 *                    busted LCD columns, hard shake, big flash;
 *   collapse(t≈1500) the shards — cut FROM the web — tumble out in 3D,
 *                    inner bands first, and the vortex waits behind.
 */
const ShatterOverlay: React.FC<{ vortex: boolean; onVortex: () => void }> = ({
  vortex,
  onVortex,
}) => {
  const crackRef = useRef<HTMLCanvasElement>(null);
  const [web, setWeb] = useState<FractureWeb | null>(null);
  const [burst, setBurst] = useState(false);
  const [fly, setFly] = useState(false);

  // shard CSS derived from the web — full-screen layers clipped to each piece
  const shardStyles = useMemo(() => {
    if (!web) return [];
    return web.shards.map((s, i) => {
      const clip = `polygon(${s.poly
        .map((p) => `${((p.x / web.W) * 100).toFixed(2)}% ${((p.y / web.H) * 100).toFixed(2)}%`)
        .join(', ')})`;
      let dx = s.centroid.x - web.impact.x;
      let dy = s.centroid.y - web.impact.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      dx /= len; dy /= len;
      const dist = 420 + Math.random() * 760 + s.band * 130;
      const rx = (Math.random() - 0.5).toFixed(2);
      const ry = (Math.random() - 0.5).toFixed(2);
      const rot = ((Math.random() - 0.5) * 300) | 0;
      return {
        key: i,
        base: {
          clipPath: clip,
          transformOrigin: `${s.centroid.x}px ${s.centroid.y}px`,
          transitionDelay: `${s.band * 95 + ((Math.random() * 150) | 0)}ms`,
          transitionDuration: `${(720 + Math.random() * 520) | 0}ms`,
        } as React.CSSProperties,
        fly: {
          transform: `translate(${(dx * dist) | 0}px, ${((dy * dist + 320) | 0)}px) rotate3d(${rx}, ${ry}, 1, ${rot}deg) scale(0.78)`,
          opacity: 0,
        } as React.CSSProperties,
      };
    });
  }, [web]);

  useEffect(() => {
    const canvas = crackRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth || window.innerWidth || 1280;
    canvas.height = canvas.clientHeight || window.innerHeight || 1024;
    const ctx = canvas.getContext('2d')!;
    const w = buildWeb(canvas.width, canvas.height);
    setWeb(w);

    // The whole break is ONE real clip (Med's glass smash). Its two audible
    // hits drive the two visual stages: the first crack lands at t=0, the
    // catastrophic collapse at the clip's main shatter peak (T_BURST). Audio
    // and picture cannot drift — both start on this same frame.
    const T_BURST = Math.round(BREAK_HIT2 * 1000); // main shatter peak in the clip
    const T_FLY = T_BURST + 120;                   // shards let go into the cascade
    playGlassBreak();
    const tB = window.setTimeout(() => setBurst(true), T_BURST);
    const tF = window.setTimeout(() => {
      setFly(true);
      canvas.style.transition = 'opacity 0.45s ease-out';
      canvas.style.opacity = '0';
    }, T_FLY);

    // band k opens at time — inner micro-web on the first hit, the outer web
    // racing out to COMPLETE exactly on the main shatter (T_BURST)
    const openT = (k: number) =>
      k <= 2 ? (k / 2) * 130 : 320 + ((k - 2) / (RF.length - 3)) * (T_BURST - 415);
    const rf = (tNow: number, k: number) =>
      Math.min(1, Math.max(0, (tNow - openT(k)) / 95));

    const lerp = (a: Pt, b: Pt, f: number): Pt => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

    const seg = (a: Pt, b: Pt, wd: number, style: string) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - start;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const isBurst = t >= T_BURST;

      // damage UNDER the cracks: dead pixels + busted LCD columns
      if (isBurst) {
        const dp = Math.min(1, (t - T_BURST) / 260);
        ctx.fillStyle = `rgba(0, 0, 0, ${(0.85 * dp).toFixed(2)})`;
        for (const d of w.deadPx) ctx.fillRect(d.x, d.y, d.w, d.h);
        for (const cx2 of w.lcdCols) {
          ctx.fillStyle = `rgba(0, 255, 65, ${((0.2 + Math.random() * 0.3) * dp).toFixed(2)})`;
          ctx.fillRect(cx2, 0, 1.6, H);
          ctx.fillStyle = `rgba(235, 255, 245, ${((0.3 + Math.random() * 0.45) * dp).toFixed(2)})`;
          ctx.fillRect(cx2 + 2, 0, 0.9, H);
        }
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // mains — segment by segment so width tapers thick→hairline
      for (const pts of w.mains) {
        for (let k = 1; k < pts.length; k++) {
          const f = rf(t, k);
          if (f <= 0) break;
          const a = pts[k - 1];
          const b = f >= 1 ? pts[k] : lerp(pts[k - 1], pts[k], f);
          const wd = 3.6 * (1 - k / pts.length) + 0.7;
          // under-glow
          seg(a, b, wd * 3.6, 'rgba(0, 255, 65, 0.28)');
          // chromatic ghosts once the pane is truly broken
          if (isBurst) {
            ctx.save();
            ctx.translate(-2.4, 0);
            seg(a, b, wd, 'rgba(255, 70, 70, 0.3)');
            ctx.translate(4.8, 0);
            seg(a, b, wd, 'rgba(70, 255, 220, 0.28)');
            ctx.restore();
          }
          // bright core
          seg(a, b, wd, 'rgba(240, 255, 248, 0.95)');
        }
      }

      // rings pop in with their band — fainter than the mains, so the radial
      // violence stays the star of the web
      for (const r of w.ringSegs) {
        const f = rf(t, r.band);
        if (f <= 0) continue;
        ctx.globalAlpha = f;
        ctx.beginPath();
        ctx.moveTo(r.pts[0].x, r.pts[0].y);
        for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i].x, r.pts[i].y);
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.2)';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(232, 255, 244, 0.6)';
        ctx.lineWidth = 0.95;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // branches fork out during the burst
      if (isBurst) {
        const bf = Math.min(1, (t - T_BURST) / 300);
        for (const bp of w.branches) {
          const upto = Math.max(2, Math.ceil(bf * bp.length));
          ctx.beginPath();
          ctx.moveTo(bp[0].x, bp[0].y);
          for (let i = 1; i < upto; i++) ctx.lineTo(bp[i].x, bp[i].y);
          ctx.strokeStyle = 'rgba(225, 255, 240, 0.7)';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      // refraction glints — tiny 4-point stars shimmering on the nodes
      for (const g of w.glints) {
        const f = rf(t, g.band);
        if (f < 1) continue;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.02 + g.seed * 7);
        if (tw < 0.35) continue;
        const s = 3 + tw * 6;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(tw * 0.9).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.p.x - s, g.p.y); ctx.lineTo(g.p.x + s, g.p.y);
        ctx.moveTo(g.p.x, g.p.y - s); ctx.lineTo(g.p.x, g.p.y + s);
        ctx.stroke();
      }

      // impact debris for the first beats
      if (t < 600) {
        const p = t / 600;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + i;
          const dr = (90 + (i % 5) * 60) * p;
          ctx.fillStyle = `rgba(220, 255, 235, ${(1 - p).toFixed(2)})`;
          ctx.fillRect(w.impact.x + Math.cos(a) * dr, w.impact.y + Math.sin(a) * dr, 2.4, 2.4);
        }
      }

      if (t < T_FLY + 500) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tB);
      clearTimeout(tF);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`mtx-shatter mtx-shatter--shake${burst ? ' mtx-shatter--quake' : ''}`}>
      <div className="mtx-break-flash" />
      {burst && <div className="mtx-break-flash mtx-break-flash--big" />}
      {shardStyles.map((s) => (
        <div
          key={s.key}
          className="mtx-shard"
          style={fly ? { ...s.base, ...s.fly } : s.base}
        />
      ))}
      <canvas ref={crackRef} className="mtx-crack" />
      {vortex && <VortexPortal onEnter={onVortex} />}
    </div>
  );
};

/** Black screen + rain + typed message. Level 2 carries the final question. */
const MatrixScreen: React.FC<{
  level: 2 | 3;
  collapsing: boolean;
  onReenter: () => void;
  onFinalUnlock: () => void;
}> = ({ level, collapsing, onReenter, onFinalUnlock }) => {
  const lines = level === 2 ? L2_LINES : L3_LINES;
  const [typed, setTyped] = useState<string[]>([]);
  const [typedDone, setTypedDone] = useState(false);
  const [btnOn, setBtnOn] = useState(false);
  const [attempt, setAttempt] = useState('');
  const [deniedText, setDeniedText] = useState(' ');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const revokedRef = useRef(false);
  const attemptRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  // level-3 finale choreography: message → countdown → shatter → vortex
  const [finaleStage, setFinaleStage] = useState<'message' | 'countdown' | 'shatter' | 'vortex'>('message');
  const [count, setCount] = useState(5);
  const [selfMode, setSelfMode] = useState(false);
  const selfModeRef = useRef(false);
  const extStartedRef = useRef(false);
  const extTargetRef = useRef(-1);
  const extDursRef = useRef<Record<number, number>>({});
  const extDoneRef = useRef(false);

  const setAttemptBoth = (v: string) => {
    attemptRef.current = v;
    setAttempt(v);
  };

  // level-3 finale text: fit each line as BIG as possible to the screen. With
  // ~18 lines on a 1024-tall CRT a single uniform size can't grow much, so we
  // size each line to fill the width (capped), then scale the whole block down
  // only if it would overrun the height. Computed once from the full lines so
  // the size never jumps while the typewriter reveals characters.
  const msgRef = useRef<HTMLDivElement>(null);
  const [bigSizes, setBigSizes] = useState<number[]>([]);
  useLayoutEffect(() => {
    if (level !== 3) return;
    const box = msgRef.current;
    if (!box || !box.clientWidth) return;
    const CAP = 78;
    const MIN = 26;
    const availW = box.clientWidth;
    const availH = box.clientHeight;

    // pass 1 — size each line to fill the width (capped)
    const probe = document.createElement('div');
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap;font-family:'Courier New',monospace;font-weight:bold";
    box.appendChild(probe);
    const sizes = lines.map((l) => {
      if (!l) return 0;
      probe.style.fontSize = `${CAP}px`;
      probe.textContent = l;
      const nat = probe.offsetWidth || 1;
      return nat > availW ? Math.max(MIN, (CAP * availW) / nat) : CAP;
    });
    box.removeChild(probe);

    // pass 2 — mirror the real stacked column (same CSS as .mtx-line--big) and
    // MEASURE its height, so the height-fit scale is exact, not estimated
    const col = document.createElement('div');
    col.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${availW}px`;
    for (let i = 0; i < lines.length; i++) {
      const d = document.createElement('div');
      d.style.cssText =
        "font-family:'Courier New',monospace;font-weight:bold;white-space:nowrap;line-height:1.12;margin-bottom:6px";
      if (lines[i]) { d.style.fontSize = `${sizes[i]}px`; d.textContent = lines[i]; }
      else { d.style.height = '16px'; d.style.marginBottom = '0'; }
      col.appendChild(d);
    }
    box.appendChild(col);
    const realH = col.offsetHeight;
    box.removeChild(col);

    const safeH = availH * 0.96; // headroom so nothing clips top/bottom
    const k = realH > safeH ? safeH / realH : 1;
    setBigSizes(sizes.map((s) => (s ? Math.round(s * k) : 0)));
  }, [level, lines]);

  // self-paced typewriter — level 2 always; level 3 only as a FALLBACK when
  // no voice drive arrives from the shell (standalone /os, TTS unavailable).
  useEffect(() => {
    if (level === 3 && !selfMode) return; // L3 normally follows the Admin's voice
    const charMs = level === 3 ? 26 : 20;
    const lineMs = level === 3 ? 320 : 300;
    let line = 0;
    let ch = 0;
    let cancelled = false;
    const acc: string[] = [];
    const type = () => {
      if (cancelled) return;
      if (line >= lines.length) { setTypedDone(true); return; }
      const target = lines[line];
      ch++;
      acc[line] = target.slice(0, ch);
      setTyped([...acc]);
      if (ch >= target.length) {
        line++;
        ch = 0;
        setTimeout(type, lineMs);
      } else {
        setTimeout(type, charMs);
      }
    };
    const t = setTimeout(type, level === 3 ? 400 : 650);
    return () => { cancelled = true; clearTimeout(t); };
  }, [lines, level, selfMode]);

  // L3: the shell speaks line-by-line and drives the typing via postMessage
  // ('adminLineStart' per line, 'adminSpeechDone' at the end). If nothing
  // arrives within 4.5s, fall back to self-typing so the finale never stalls.
  useEffect(() => {
    if (level !== 3) return;
    const t = setTimeout(() => {
      if (!extStartedRef.current) {
        selfModeRef.current = true;
        setSelfMode(true);
      }
    }, 4500);
    return () => clearTimeout(t);
  }, [level]);

  useEffect(() => {
    if (level !== 3) return;
    const acc: string[] = [];
    let ch = 0;
    let curLine = -1;
    let finished = false;
    // pace each line's typing to its SPEECH duration. The shell sends the
    // real per-line duration measured off the voice clip's cue table; when
    // absent (TTS fallback) estimate from word count (≈2.4 words/sec).
    let pace = 30;
    let budget = 0;
    const paceFor = (line: string, durMs?: number) => {
      if (!line) return 30;
      const est = durMs ?? (Math.max(1, line.trim().split(/\s+/).length) / 2.4) * 1000;
      // finish the line slightly BEFORE the voice moves on
      return Math.min(95, Math.max(16, (est * 0.86) / Math.max(line.length, 1)));
    };
    const iv = window.setInterval(() => {
      if (selfModeRef.current || finished) return;
      const tgt = extTargetRef.current;
      if (tgt < 0) return;
      // everything before the line being spoken is fully revealed
      for (let i = 0; i < Math.min(tgt, lines.length); i++) acc[i] = lines[i];
      if (curLine !== tgt) {
        curLine = tgt;
        ch = acc[tgt]?.length ?? 0;
        pace = paceFor(lines[tgt] ?? '', extDursRef.current[tgt]);
        budget = 0;
      }
      if (tgt < lines.length && ch < lines[tgt].length) {
        budget += 30 / pace;
        while (budget >= 1 && ch < lines[tgt].length) {
          ch++;
          budget--;
        }
        acc[tgt] = lines[tgt].slice(0, ch);
      }
      if (extDoneRef.current) {
        for (let i = 0; i < lines.length; i++) acc[i] = lines[i];
        finished = true;
        setTyped([...acc]);
        setTypedDone(true);
        return;
      }
      setTyped([...acc]);
    }, 30);
    const onMsg = (e: MessageEvent) => {
      if (selfModeRef.current) return;
      if (e.data?.type === 'adminLineStart' && typeof e.data.index === 'number') {
        extStartedRef.current = true;
        if (typeof e.data.dur === 'number') extDursRef.current[e.data.index] = e.data.dur;
        extTargetRef.current = e.data.index;
      } else if (e.data?.type === 'adminSpeechDone') {
        extStartedRef.current = true;
        extDoneRef.current = true;
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      clearInterval(iv);
      window.removeEventListener('message', onMsg);
    };
  }, [level, lines]);

  // message done → breathe → countdown → the OS breaks → the vortex
  useEffect(() => {
    if (level !== 3 || !typedDone || finaleStage !== 'message') return;
    const t = setTimeout(() => setFinaleStage('countdown'), 1400);
    return () => clearTimeout(t);
  }, [level, typedDone, finaleStage]);

  useEffect(() => {
    if (finaleStage !== 'countdown') return;
    preloadGlassBreak(); // decode the smash now so it fires in sync on the break
    setCount(5);
    playCountdownTick(5);
    const iv = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(iv);
          setFinaleStage('shatter');
          return 0;
        }
        playCountdownTick(c - 1);
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [finaleStage]);

  useEffect(() => {
    if (finaleStage !== 'shatter') return;
    // ShatterOverlay drives its own audio timeline (pop → break → cascade);
    // the vortex fades in once the shards have cleared the frame.
    const t = setTimeout(() => setFinaleStage('vortex'), 2600);
    return () => clearTimeout(t);
  }, [finaleStage]);

  // the way out fades in after the screen has sunk in (level 2 only —
  // level 3 hands control to the room and the Admin)
  useEffect(() => {
    if (level !== 2) return;
    const t = setTimeout(() => setBtnOn(true), 2200);
    return () => clearTimeout(t);
  }, [level]);

  const tryFinal = () => {
    if (revokedRef.current) return;
    if (A3.test(attemptRef.current.trim())) {
      track('secret_stage_passed', { stage: 'tokens', order: 3 });
      playFinaleRiser(); // fire inside the click gesture; the room syncs to it
      onFinalUnlock();
      return;
    }
    // three attempts at the final gate — miss them all and the machine
    // revokes access: kicked out, and Secret Files burns on the way (the
    // existing exit path removes the app).
    const left = attemptsLeft - 1;
    setAttemptsLeft(left);
    setAttemptBoth('');
    track('secret_wrong_answer', { stage: 'tokens', attemptsLeft: left });
    if (left <= 0) {
      revokedRef.current = true;
      track('secret_failed', { stage: 'tokens' });
      setDeniedText('> ACCESS REVOKED. THE MACHINE FORGETS YOU.');
      setTimeout(onReenter, 1600);
      return;
    }
    setDeniedText(`> ACCESS DENIED. ${left} ATTEMPT${left === 1 ? '' : 'S'} REMAINING.`);
    setTimeout(() => setDeniedText(' '), 2200);
  };

  // Type-anywhere net: DOM focus follows clicks, not hover — after a camera
  // trip the iframe/input can silently lose focus and keystrokes go nowhere.
  // On the final question, ANY key lands in the answer field regardless.
  useEffect(() => {
    if (level !== 2 || !typedDone) return;
    const onKey = (e: KeyboardEvent) => {
      const el = inputRef.current;
      if (!el || document.activeElement === el) return;
      if (e.key === 'Enter') { tryFinal(); return; }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setAttemptBoth(attemptRef.current.slice(0, -1));
        el.focus();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setAttemptBoth(attemptRef.current + e.key);
        el.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, typedDone]);

  return (
    <div
      className={`mtx-screen${collapsing ? ' mtx-screen--off' : ''}`}
      onMouseDown={() => inputRef.current?.focus()}
    >
      {finaleStage !== 'shatter' && finaleStage !== 'vortex' && <MatrixRainFull />}
      {(level === 2 || finaleStage === 'message') && (
        <div
          ref={level === 3 ? msgRef : undefined}
          className={`mtx-message${level === 3 ? ' mtx-message--big' : ''}`}
        >
          {typed.map((l, i) => (
            <p
              key={i}
              className={`mtx-line${level === 3 ? ' mtx-line--big' : ''}`}
              style={level === 3 && bigSizes[i] ? { fontSize: `${bigSizes[i]}px` } : undefined}
            >
              {l}
            </p>
          ))}
          {level === 2 && typedDone && (
            <div className="mtx-answer-block">
              <div className="mtx-answer-row">
                <span className="mtx-line">{'>'}</span>
                <input
                  ref={inputRef}
                  className="mtx-input"
                  type="text"
                  autoFocus
                  value={attempt}
                  onChange={(e) => setAttemptBoth(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') tryFinal(); }}
                />
                <button className="mtx-answer-btn" onMouseDown={tryFinal}>
                  [ ANSWER ]
                </button>
              </div>
              <p className="mtx-line mtx-denied">{deniedText}</p>
            </div>
          )}
          <p className="mtx-line mtx-cursor">█</p>
        </div>
      )}
      <div className="mtx-scanlines" />
      {level === 3 && finaleStage === 'countdown' && (
        <div className="mtx-countdown">{count}</div>
      )}
      {level === 3 && (finaleStage === 'shatter' || finaleStage === 'vortex') && (
        <ShatterOverlay vortex={finaleStage === 'vortex'} onVortex={onReenter} />
      )}
      {level === 2 && (
        <button
          className={`mtx-reenter${btnOn ? ' mtx-reenter--on' : ''}`}
          onMouseDown={onReenter}
        >
          <span className="mtx-glitch-text" data-text="CLICK HERE TO GO BACK">
            CLICK HERE TO GO BACK
          </span>
        </button>
      )}
    </div>
  );
};

const MatrixTakeover: React.FC<MatrixTakeoverProps> = ({
  phase, level, subjectRef, onReenter, onFinalUnlock,
}) => {
  const turbRef = useRef<SVGFETurbulenceElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  const rOffRef = useRef<SVGFEOffsetElement>(null);
  const bOffRef = useRef<SVGFEOffsetElement>(null);
  const noiseRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [flashText, setFlashText] = useState<string | null>(null);

  // kill focus so keystrokes don't land in a window input mid-shred
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  // ── glitch driver: animates the SVG filter + subject jitter + artifacts ──
  useEffect(() => {
    if (phase !== 'glitch' && phase !== 'exit') return;
    const subject = subjectRef.current;
    const turb = turbRef.current;
    const disp = dispRef.current;
    const rOff = rOffRef.current;
    const bOff = bOffRef.current;
    const noiseCanvas = noiseRef.current;
    const nctx = noiseCanvas?.getContext('2d') ?? null;
    if (subject) subject.style.willChange = 'filter, transform';

    const duration = phase === 'glitch' ? GLITCH_MS : 950;
    const start = performance.now();
    let spikeUntil = 0;
    let lastExtraAt = 0; // rate-limit the invert/flash pops (no strobing)
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = Math.min(1, (now - start) / duration);
      // glitch escalates toward the cut; exit decays back to a clean desktop
      const base = phase === 'glitch' ? 0.15 + t * 0.85 : (1 - t) * 0.55;

      if (now > spikeUntil && Math.random() < 0.1) {
        spikeUntil = now + 50 + Math.random() * 130;
        // x-frequency 0 → noise varies only vertically → whole rows slide
        // sideways: genuine slice displacement of the live desktop
        turb?.setAttribute('baseFrequency', `0 ${(0.06 + Math.random() * 0.35).toFixed(3)}`);
        if (Math.random() < 0.4) turb?.setAttribute('seed', String((Math.random() * 100) | 0));
      }
      const spiking = now < spikeUntil;
      const intensity = Math.min(1.6, base + (spiking ? 0.5 + Math.random() * 0.8 : 0));

      disp?.setAttribute('scale', (spiking ? intensity * 90 : intensity * 7).toFixed(1));
      const split = spiking ? intensity * 9 : intensity * 1.5;
      rOff?.setAttribute('dx', (-split).toFixed(1));
      bOff?.setAttribute('dx', split.toFixed(1));

      if (subject) {
        const jx = spiking ? (Math.random() - 0.5) * intensity * 14 : 0;
        const jy = spiking ? (Math.random() - 0.5) * intensity * 8 : 0;
        let extra = '';
        if (spiking && now - lastExtraAt > 300 && Math.random() < 0.3) {
          lastExtraAt = now;
          extra = Math.random() < 0.5
            ? ' invert(1) hue-rotate(90deg) saturate(2.5)'
            : ' brightness(2.2) contrast(1.6)';
        }
        subject.style.transform = `translate(${jx.toFixed(1)}px, ${jy.toFixed(1)}px)`;
        subject.style.filter = `url(#os-glitch-filter)${extra}`;
      }

      if (nctx && noiseCanvas) {
        if (spiking) {
          const img = nctx.createImageData(noiseCanvas.width, noiseCanvas.height);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const v = (Math.random() * 255) | 0;
            d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
          }
          nctx.putImageData(img, 0, 0);
          noiseCanvas.style.opacity = (0.05 + intensity * 0.14).toFixed(2);
        } else {
          noiseCanvas.style.opacity = '0';
        }
      }

      if (barsRef.current) {
        const bars = Array.from(barsRef.current.children) as HTMLElement[];
        for (const bar of bars) {
          if (spiking && Math.random() < 0.75) {
            bar.style.opacity = (0.15 + Math.random() * 0.4).toFixed(2);
            bar.style.top = `${(Math.random() * 100).toFixed(1)}%`;
            bar.style.height = `${(1 + Math.random() * 7).toFixed(1)}%`;
            bar.style.transform = `translateX(${((Math.random() - 0.5) * 30).toFixed(1)}px)`;
          } else {
            bar.style.opacity = '0';
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      if (subject) {
        subject.style.filter = '';
        subject.style.transform = '';
        subject.style.willChange = '';
      }
      if (noiseCanvas) noiseCanvas.style.opacity = '0';
    };
  }, [phase, subjectRef]);

  // ── flash text during the shred ──
  useEffect(() => {
    if (phase !== 'glitch') return;
    const timers: number[] = [];
    for (const f of GLITCH_FLASHES) {
      timers.push(window.setTimeout(() => setFlashText(f.text), f.at));
      timers.push(window.setTimeout(() => setFlashText(null), f.at + f.dur));
    }
    return () => { timers.forEach(clearTimeout); setFlashText(null); };
  }, [phase]);

  // ── audio per phase/level ──
  useEffect(() => {
    if (phase === 'glitch') {
      playPowerDown();
      return startGlitchStatic();
    }
    if (phase === 'matrix') {
      if (level === 2) {
        // stage-2 score + a sub-drone underneath for weight
        const stopMusic = startMatrixMusic();
        const stopDrone = startMatrixDrone();
        return () => { stopMusic(); stopDrone(); };
      }
      // level 3: the riser fired at the unlock click; run the darker finale
      return startMatrixFinale();
    }
    // exit: zap + a short burst of static while the desktop re-forms
    playReenterZap();
    return startGlitchStatic();
  }, [phase, level]);

  // ── bridge to the 3D room shell ──
  // Level 3 tells the parent (the Three.js room) to digitize; exit restores.
  // Level 2 posts nothing — the room outside stays normal. On the standalone
  // /os route window.parent === window and nothing listens: harmless no-op.
  useEffect(() => {
    try {
      if (phase === 'matrix' && level === 3) {
        // ship the Admin's lines along so the shell can SPEAK the same text
        window.parent.postMessage({ type: 'matrixFinale', lines: L3_LINES }, '*');
      } else if (phase === 'exit') {
        window.parent.postMessage({ type: 'matrixExit' }, '*');
      }
    } catch {}
  }, [phase, level]);

  // Escape is a guaranteed way out at every stage.
  useEffect(() => {
    if (phase !== 'matrix') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onReenter(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onReenter]);

  return (
    <div className="mtx-overlay">
      <svg className="mtx-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="os-glitch-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              ref={turbRef}
              type="fractalNoise"
              baseFrequency="0 0.14"
              numOctaves="1"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
              result="shred"
            />
            <feColorMatrix
              in="shred"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="r"
            />
            <feOffset ref={rOffRef} in="r" dx="0" dy="0" result="ro" />
            <feColorMatrix
              in="shred"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="g"
            />
            <feColorMatrix
              in="shred"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="b"
            />
            <feOffset ref={bOffRef} in="b" dx="0" dy="0" result="bo" />
            <feBlend in="ro" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="bo" mode="screen" />
          </filter>
        </defs>
      </svg>

      {(phase === 'glitch' || phase === 'exit') && (
        <>
          <canvas ref={noiseRef} width={180} height={135} className="mtx-noise" />
          <div ref={barsRef} className="mtx-tearbars">
            <div className="mtx-tearbar mtx-tearbar--green" />
            <div className="mtx-tearbar mtx-tearbar--white" />
            <div className="mtx-tearbar mtx-tearbar--black" />
            <div className="mtx-tearbar mtx-tearbar--green" />
            <div className="mtx-tearbar mtx-tearbar--white" />
          </div>
          {flashText && <p className="mtx-flashtext">{flashText}</p>}
        </>
      )}

      {(phase === 'matrix' || phase === 'exit') && (
        <MatrixScreen
          key={level}
          level={level}
          collapsing={phase === 'exit'}
          onReenter={onReenter}
          onFinalUnlock={onFinalUnlock}
        />
      )}
    </div>
  );
};

export default MatrixTakeover;
