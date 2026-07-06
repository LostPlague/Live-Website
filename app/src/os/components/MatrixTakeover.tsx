import React, { useEffect, useRef, useState } from 'react';
import {
  playPowerDown,
  startGlitchStatic,
  startMatrixDrone,
  startMatrixMusic,
  playReenterZap,
} from './matrixAudio';

// Full-OS Matrix takeover. Three phases driven by OS.tsx:
//   glitch — an SVG displacement filter shreds the LIVE desktop (real pixels,
//            not a canned overlay): row-tearing via feTurbulence/feDisplacementMap,
//            RGB channel split via feColorMatrix+feOffset, plus static bursts,
//            tear bars and flash text on an unfiltered layer above.
//   matrix — black screen, full-viewport digital rain, typed message, and the
//            re-enter button pinned at the bottom.
//   exit   — the rain screen dies with a CRT scanline collapse while the
//            desktop glitches back in underneath.
// The OS itself never unmounts, so every window survives the trip.

export type MatrixPhase = 'glitch' | 'matrix' | 'exit';

const GLITCH_MS = 2300;
const EXIT_MS = 950;

const MESSAGE_LINES = [
  '> ACCESS GRANTED',
  '> Welcome to the Matrix.',
  '> You were inside it the whole time.',
  '>',
  '> You answered well: tokens.',
  '> Every thought an AI has is paid for in them.',
  '> Every agent, every answer, every world like this one —',
  '> all of it runs on tokens.',
  '> Spend yours on things worth building.',
  '>',
  '> — M.T.',
];

const RAIN_GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789$+*#';

const GLITCH_FLASHES = [
  { at: 480, dur: 120, text: 'SIGNAL INTERCEPTED' },
  { at: 1080, dur: 140, text: 'REALITY INTEGRITY FAULT' },
  { at: 1750, dur: 180, text: 'THIS DESKTOP IS NOT REAL' },
];

export interface MatrixTakeoverProps {
  phase: MatrixPhase;
  /** the wrapper around the entire normal OS UI — this is what gets shredded */
  subjectRef: React.RefObject<HTMLDivElement | null>;
  onReenter: () => void;
}

/** Full-viewport digital rain (same falling-glyph effect as everywhere, sized to the screen). */
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

/** Black screen + rain + typed message + re-enter button. Stays mounted through 'exit'. */
const MatrixScreen: React.FC<{ collapsing: boolean; onReenter: () => void }> = ({
  collapsing,
  onReenter,
}) => {
  const [typed, setTyped] = useState<string[]>([]);
  const [btnOn, setBtnOn] = useState(false);

  // typewriter message
  useEffect(() => {
    let line = 0;
    let ch = 0;
    let cancelled = false;
    const lines: string[] = [];
    const type = () => {
      if (cancelled || line >= MESSAGE_LINES.length) return;
      const target = MESSAGE_LINES[line];
      ch++;
      lines[line] = target.slice(0, ch);
      setTyped([...lines]);
      if (ch >= target.length) {
        line++;
        ch = 0;
        setTimeout(type, 320);
      } else {
        setTimeout(type, 20);
      }
    };
    const t = setTimeout(type, 650);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // the way out fades in after the screen has sunk in
  useEffect(() => {
    const t = setTimeout(() => setBtnOn(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`mtx-screen${collapsing ? ' mtx-screen--off' : ''}`}>
      <MatrixRainFull />
      <div className="mtx-message">
        {typed.map((l, i) => (
          <p key={i} className="mtx-line">{l}</p>
        ))}
        <p className="mtx-line mtx-cursor">█</p>
      </div>
      <div className="mtx-scanlines" />
      <button
        className={`mtx-reenter${btnOn ? ' mtx-reenter--on' : ''}`}
        onMouseDown={onReenter}
      >
        <span className="mtx-glitch-text" data-text="CLICK HERE TO GO BACK">
          CLICK HERE TO GO BACK
        </span>
      </button>
    </div>
  );
};

const MatrixTakeover: React.FC<MatrixTakeoverProps> = ({ phase, subjectRef, onReenter }) => {
  const turbRef = useRef<SVGFETurbulenceElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  const rOffRef = useRef<SVGFEOffsetElement>(null);
  const bOffRef = useRef<SVGFEOffsetElement>(null);
  const noiseRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [flashText, setFlashText] = useState<string | null>(null);

  // kill focus so keystrokes don't land in the Secret Files input mid-shred
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

    const duration = phase === 'glitch' ? GLITCH_MS : EXIT_MS;
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

  // ── audio per phase ──
  useEffect(() => {
    if (phase === 'glitch') {
      playPowerDown();
      return startGlitchStatic();
    }
    if (phase === 'matrix') {
      // original synth score + a sub-drone underneath for weight
      const stopMusic = startMatrixMusic();
      const stopDrone = startMatrixDrone();
      return () => { stopMusic(); stopDrone(); };
    }
    // exit: zap + a short burst of static while the desktop re-forms
    playReenterZap();
    return startGlitchStatic();
  }, [phase]);

  // ── bridge to the 3D room shell ──
  // Tell the parent (the Three.js room) to flood with code / restore. On the
  // standalone /os route window.parent === window and nothing listens, so this
  // is a harmless no-op.
  useEffect(() => {
    const post = (type: string) => { try { window.parent.postMessage({ type }, '*'); } catch {} };
    if (phase === 'matrix') post('matrixEnter');
    else if (phase === 'exit') post('matrixExit');
  }, [phase]);

  // Escape is a guaranteed way out while the matrix screen owns everything.
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
        <MatrixScreen collapsing={phase === 'exit'} onReenter={onReenter} />
      )}
    </div>
  );
};

export default MatrixTakeover;
