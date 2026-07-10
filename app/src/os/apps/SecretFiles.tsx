import React, { useEffect, useRef, useState } from 'react';
import { Window } from '../components/Window';
import lockIcon from '../assets/lockIcon.png';
import { playAccessChirp } from '../components/matrixAudio';
import { track } from '../../analytics';

// Secret Files — a three-stage descent. This window owns STAGE 1:
//   q1  — locked Win98 dialog, clearance question 1 (hallucination).
//   s1  — the window (only the window) flips to matrix rain with a typed
//         comment on the answer, then question 2 (turing). Answering it fires
//         onEnterMatrix() and STAGE 2 (the full-OS takeover, owned by OS.tsx)
//         begins. Stage 3 (the whole site/room) is unlocked from there.
// Give-up here just closes the file — the app stays on the desktop. Deeper
// give-ups (stage 2+) burn the app entirely (OS.tsx handles that).

const Q1 = 'What do you call it when an AI invents facts and states them with total confidence?';
const A1 = /hallucinat/i;
const Q2 = 'What is the name of the test that decides whether a machine can pass as human?';
const A2 = /turing/i;

const S1_LINES = [
  '> CLEARANCE 1 GRANTED',
  '> Hallucination — a machine dreaming, and calling it truth.',
  '> Most of what you see was dreamed by something.',
  '>',
  '> STAGE 2 IS LOCKED. Answer to go deeper:',
];

const RAIN_GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789$+*#';

export interface SecretFilesProps {
  onClose: () => void;
  onMinimize: () => void;
  /** fires the full-OS Matrix takeover — STAGE 2 (owned by OS.tsx) */
  onEnterMatrix: () => void;
}

/** In-window digital rain backdrop (stage 1 scale — the window falls first). */
const MiniRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext('2d')!;
    const fontSize = 14;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.floor(Math.random() * -40));
    let raf = 0;
    let last = 0;
    const tickFrame = (t: number) => {
      raf = requestAnimationFrame(tickFrame);
      if (t - last < 50) return;
      last = t;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < columns; i++) {
        const glyph = RAIN_GLYPHS[Math.floor(Math.random() * RAIN_GLYPHS.length)];
        const y = drops[i] * fontSize;
        ctx.fillStyle = '#9dffb0';
        ctx.fillText(glyph, i * fontSize, y);
        ctx.fillStyle = '#00c936';
        ctx.fillText(glyph, i * fontSize, y - fontSize);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    raf = requestAnimationFrame(tickFrame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="app-secret-rain" />;
};

const SecretFiles: React.FC<SecretFilesProps> = (props) => {
  const [stage, setStage] = useState<'q1' | 's1'>('q1');
  const [attempt, setAttempt] = useState('');
  const [denied, setDenied] = useState(false);
  const [typed, setTyped] = useState<string[]>([]);
  const [typedDone, setTypedDone] = useState(false);
  const stageT0 = useRef(Date.now()); // time-to-crack clock, reset per level

  // funnel: they opened the Secret Files
  useEffect(() => { track('secret_opened'); }, []);

  // typewriter for the stage-1 matrix comment
  useEffect(() => {
    if (stage !== 's1') return;
    let line = 0;
    let ch = 0;
    let cancelled = false;
    const lines: string[] = [];
    const type = () => {
      if (cancelled) return;
      if (line >= S1_LINES.length) { setTypedDone(true); return; }
      const target = S1_LINES[line];
      if (target.length === 0) { lines[line] = ''; line++; setTyped([...lines]); setTimeout(type, 200); return; }
      ch++;
      lines[line] = target.slice(0, ch);
      setTyped([...lines]);
      if (ch >= target.length) { line++; ch = 0; setTimeout(type, 300); }
      else setTimeout(type, 18);
    };
    const t = setTimeout(type, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [stage]);

  const deny = () => {
    setDenied(true);
    setTimeout(() => setDenied(false), 1600);
  };

  const tryStage1 = () => {
    if (A1.test(attempt.trim())) {
      track('secret_stage_passed', { stage: 'hallucination', order: 1, seconds: Math.round((Date.now() - stageT0.current) / 1000) });
      playAccessChirp();
      setAttempt('');
      stageT0.current = Date.now(); // level 2's clock starts now
      setStage('s1');
    } else {
      track('secret_wrong_answer', { stage: 'hallucination' });
      deny();
    }
  };

  const tryStage2 = () => {
    if (A2.test(attempt.trim())) {
      track('secret_stage_passed', { stage: 'turing', order: 2, seconds: Math.round((Date.now() - stageT0.current) / 1000) });
      setAttempt('');
      props.onEnterMatrix();
    } else {
      track('secret_wrong_answer', { stage: 'turing' });
      deny();
    }
  };

  const giveUp = () => {
    track('secret_gave_up', { stage: 'turing' });
    props.onClose();
  };

  return (
    <Window
      initialTop={140}
      initialLeft={330}
      initialWidth={620}
      initialHeight={480}
      title="Secret Files"
      iconSrc={lockIcon}
      onClose={props.onClose}
      onMinimize={props.onMinimize}
      bottomLeftText={stage === 'q1' ? 'Clearance: 0 / 3' : 'Clearance: 1 / 3'}
    >
      {stage === 'q1' ? (
        <div className="app-secret-lock">
          <img src={lockIcon} alt="" className="app-secret-lock-icon" />
          <p className="app-secret-title">RESTRICTED — AUTHORIZED ACCESS ONLY</p>
          <p className="app-secret-subtitle">CLEARANCE 1 OF 3</p>
          <br />
          <p className="app-secret-question">{Q1}</p>
          <br />
          <input
            className="app-secret-input"
            type="text"
            placeholder="Answer"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') tryStage1(); }}
          />
          <br />
          <button className="app-win98-button" onMouseDown={tryStage1}>
            Unlock
          </button>
          <p className="app-secret-denied">{denied ? 'ACCESS DENIED.' : ' '}</p>
        </div>
      ) : (
        <div className="app-secret-stage1">
          <MiniRain />
          <div className="app-secret-s1-content">
            {typed.map((l, i) => (
              <p key={i} className="app-secret-line">{l}</p>
            ))}
            {typedDone && (
              <div className="app-secret-s1-gate">
                <p className="app-secret-line app-secret-q2">{'> '}{Q2}</p>
                <div className="app-secret-s1-row">
                  <span className="app-secret-line">{'>'}</span>
                  <input
                    className="app-secret-terminal-input"
                    type="text"
                    autoFocus
                    value={attempt}
                    onChange={(e) => setAttempt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') tryStage2(); }}
                  />
                  <button className="app-secret-terminal-btn" onMouseDown={tryStage2}>
                    [ DESCEND ]
                  </button>
                </div>
                <p className="app-secret-line app-secret-denied-green">
                  {denied ? '> ACCESS DENIED. THE MACHINE REMEMBERS.' : ' '}
                </p>
                <button className="app-secret-giveup" onMouseDown={giveUp}>
                  [ CLOSE THE FILE — STAY ON THE SURFACE ]
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Window>
  );
};

export default SecretFiles;
