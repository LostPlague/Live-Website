import React, { useEffect, useRef, useState } from 'react';
import {
  playPowerDown,
  startGlitchStatic,
  startMatrixDrone,
  startMatrixMusic,
  startMatrixFinale,
  playFinaleRiser,
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

const L3_LINES = [
  '> FINAL CLEARANCE GRANTED.',
  '> exiting the machine…',
  '>',
  '> the Admin will see you now.',
  '> (ESC returns you to the simulation)',
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
  const [denied, setDenied] = useState(false);

  // typewriter message
  useEffect(() => {
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
        setTimeout(type, 300);
      } else {
        setTimeout(type, 20);
      }
    };
    const t = setTimeout(type, 650);
    return () => { cancelled = true; clearTimeout(t); };
  }, [lines]);

  // the way out fades in after the screen has sunk in (level 2 only —
  // level 3 hands control to the room and the Admin)
  useEffect(() => {
    if (level !== 2) return;
    const t = setTimeout(() => setBtnOn(true), 2200);
    return () => clearTimeout(t);
  }, [level]);

  const tryFinal = () => {
    if (A3.test(attempt.trim())) {
      playFinaleRiser(); // fire inside the click gesture; the room syncs to it
      onFinalUnlock();
    } else {
      setDenied(true);
      setTimeout(() => setDenied(false), 1600);
    }
  };

  return (
    <div className={`mtx-screen${collapsing ? ' mtx-screen--off' : ''}`}>
      <MatrixRainFull />
      <div className="mtx-message">
        {typed.map((l, i) => (
          <p key={i} className="mtx-line">{l}</p>
        ))}
        {level === 2 && typedDone && (
          <div className="mtx-answer-block">
            <div className="mtx-answer-row">
              <span className="mtx-line">{'>'}</span>
              <input
                className="mtx-input"
                type="text"
                autoFocus
                value={attempt}
                onChange={(e) => setAttempt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') tryFinal(); }}
              />
              <button className="mtx-answer-btn" onMouseDown={tryFinal}>
                [ ANSWER ]
              </button>
            </div>
            <p className="mtx-line mtx-denied">
              {denied ? '> ACCESS DENIED. THE MACHINE REMEMBERS.' : ' '}
            </p>
          </div>
        )}
        <p className="mtx-line mtx-cursor">█</p>
      </div>
      <div className="mtx-scanlines" />
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
    const post = (type: string) => { try { window.parent.postMessage({ type }, '*'); } catch {} };
    if (phase === 'matrix' && level === 3) post('matrixFinale');
    else if (phase === 'exit') post('matrixExit');
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
