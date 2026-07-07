import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  playPowerDown,
  startGlitchStatic,
  startMatrixDrone,
  startMatrixMusic,
  startMatrixFinale,
  playFinaleRiser,
  playCountdownTick,
  playShatterCrash,
  playReenterZap,
} from './matrixAudio';

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
 * Galaxy-style: three spiral arms of glowing particles with motion trails
 * (fade-instead-of-clear + additive compositing), a pulsing white-green core,
 * and a breathing event-horizon ring. The whole canvas also slow-rotates in
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
    const parts = new Array(340).fill(0).map(() => {
      const arm = (Math.random() * ARMS) | 0;
      return {
        a: (arm / ARMS) * Math.PI * 2 + Math.random() * 0.9, // clustered per arm
        r: 24 + Math.random() * (c - 30),
        s: 0.6 + Math.random() * 1.4,
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
      // breathing event-horizon ring
      ctx.strokeStyle = `rgba(0, 255, 65, ${(0.25 + 0.15 * Math.sin(t * 3.1)).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c, c, c - 12 + Math.sin(t * 1.7) * 4, 0, Math.PI * 2);
      ctx.stroke();
      // spiral arms spinning inward
      for (const p of parts) {
        p.a += (0.022 + (c - p.r) * 0.0007) * p.s;
        p.r -= 0.55 * p.s;
        if (p.r < 12) p.r = c - 26 + Math.random() * 14;
        const wobble = Math.sin(p.a * 3 + t) * 2;
        const x = c + Math.cos(p.a) * (p.r + wobble);
        const y = c + Math.sin(p.a) * (p.r + wobble) * 0.9;
        const b = 1 - p.r / c;
        const size = 1.2 + b * 3.2;
        ctx.fillStyle = `rgba(${(60 + b * 170) | 0}, 255, ${(110 + b * 130) | 0}, ${(0.2 + b * 0.8).toFixed(2)})`;
        ctx.fillRect(x, y, size, size);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mtx-vortex-wrap" onMouseDown={onEnter}>
      <canvas ref={ref} width={520} height={520} className="mtx-vortex" />
      <p className="mtx-vortex-hint">[ THE WAY BACK ]</p>
    </div>
  );
};

/** The OS breaks: cracks spider out, shards fall away, the vortex waits behind. */
const ShatterOverlay: React.FC<{ vortex: boolean; onVortex: () => void }> = ({
  vortex,
  onVortex,
}) => {
  const crackRef = useRef<HTMLCanvasElement>(null);
  const [fly, setFly] = useState(false);

  // shard geometry: a jittered 5×5 grid of jagged quads, precomputed once
  const shards = useMemo(() => {
    const list: { key: number; base: React.CSSProperties; fly: React.CSSProperties }[] = [];
    const COLS = 5;
    const ROWS = 5;
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const j = () => 9 - Math.random() * 18; // % jitter on each corner
        const clip = `polygon(${j()}% ${j()}%, ${100 + j()}% ${j()}%, ${100 + j()}% ${100 + j()}%, ${j()}% ${100 + j()}%)`;
        const dx = (col - 2) * (150 + Math.random() * 320);
        const dy = 380 + Math.random() * 780;
        const rx = (Math.random() - 0.5).toFixed(2);
        const ry = (Math.random() - 0.5).toFixed(2);
        const rot = ((Math.random() - 0.5) * 260) | 0;
        list.push({
          key: r * COLS + col,
          base: {
            left: `${col * 20}%`,
            top: `${r * 20}%`,
            width: '20%',
            height: '20%',
            clipPath: clip,
            transitionDelay: `${(Math.random() * 380) | 0}ms`,
            transitionDuration: `${(800 + Math.random() * 600) | 0}ms`,
          },
          fly: {
            // tumbling in 3D, shrinking as they fall
            transform: `translate(${dx | 0}px, ${dy | 0}px) rotate3d(${rx}, ${ry}, 1, ${rot}deg) scale(0.72)`,
            opacity: 0,
          },
        });
      }
    }
    return list;
  }, []);

  // cracks race outward for ~0.4s, then the shards let go
  useEffect(() => {
    const canvas = crackRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = canvas.getContext('2d')!;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxR = Math.hypot(cx, cy);
    const cracks = new Array(13).fill(0).map(() => ({
      a: Math.random() * Math.PI * 2,
      wobble: 0.5 + Math.random() * 0.9,
    }));
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / 380);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(200, 255, 220, 0.9)';
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 8;
      for (const cr of cracks) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        let a = cr.a;
        const segs = 9;
        for (let s = 1; s <= segs; s++) {
          const rr = (maxR * p * s) / segs;
          a += (Math.random() - 0.5) * 0.3 * cr.wobble;
          ctx.lineWidth = Math.max(0.5, 3 * (1 - s / segs));
          ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const t = window.setTimeout(() => setFly(true), 430);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="mtx-shatter mtx-shatter--shake">
      <div className="mtx-break-flash" />
      {shards.map((s) => (
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
  const extDoneRef = useRef(false);

  const setAttemptBoth = (v: string) => {
    attemptRef.current = v;
    setAttempt(v);
  };

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
    // pace each line's typing to its estimated SPEECH duration so text and
    // voice advance together (≈2.4 words/sec at utterance rate 0.95)
    let pace = 30;
    let budget = 0;
    const paceFor = (line: string) => {
      if (!line) return 30;
      const words = Math.max(1, line.trim().split(/\s+/).length);
      const estMs = (words / 2.4) * 1000;
      return Math.min(95, Math.max(22, estMs / Math.max(line.length, 1)));
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
        pace = paceFor(lines[tgt] ?? '');
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
    playShatterCrash();
    const t = setTimeout(() => setFinaleStage('vortex'), 1500);
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
    if (left <= 0) {
      revokedRef.current = true;
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
        <div className={`mtx-message${level === 3 ? ' mtx-message--big' : ''}`}>
          {typed.map((l, i) => (
            <p key={i} className={`mtx-line${level === 3 ? ' mtx-line--big' : ''}`}>{l}</p>
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
