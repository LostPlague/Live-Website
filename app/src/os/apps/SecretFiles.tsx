import React, { useEffect, useRef, useState } from 'react';
import { Window } from '../components/Window';
import lockIcon from '../assets/lockIcon.png';

// Secret Files — locked Win98 dialog. Correct answer flips the window into a
// green digital-rain screen with a typed-out message. Rain is a canvas effect
// (falling glyph columns with fade trails); all message text is original.

const QUESTION = 'What is the most valuable resource in the AI world?';
const ANSWER = /^tokens?$/i;

const MESSAGE_LINES = [
  '> ACCESS GRANTED',
  '> Welcome to the Matrix.',
  '> You answered well: tokens.',
  '> Every thought an AI has is paid for in them.',
  '> Every agent, every answer, every world like this one —',
  '> all of it runs on tokens.',
  '> Spend yours on things worth building.',
  '>',
  '> — M.T.',
];

const RAIN_GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789$+*#';

export interface SecretFilesProps {
  onClose: () => void;
  onMinimize: () => void;
}

const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [typed, setTyped] = useState<string[]>([]);

  // digital rain
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext('2d')!;
    const fontSize = 16;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.floor(Math.random() * -40));

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 50) return; // ~20fps, era-appropriate chunkiness
      last = t;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < columns; i++) {
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
    return () => cancelAnimationFrame(raf);
  }, []);

  // typewriter message
  useEffect(() => {
    let line = 0;
    let ch = 0;
    let cancelled = false;
    const lines: string[] = [];
    const type = () => {
      if (cancelled) return;
      if (line >= MESSAGE_LINES.length) return;
      const target = MESSAGE_LINES[line];
      ch++;
      lines[line] = target.slice(0, ch);
      setTyped([...lines]);
      if (ch >= target.length) {
        line++;
        ch = 0;
        setTimeout(type, 420);
      } else {
        setTimeout(type, 28);
      }
    };
    const t = setTimeout(type, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    <div className="app-secret-matrix">
      <canvas ref={canvasRef} className="app-secret-canvas" />
      <div className="app-secret-message">
        {typed.map((l, i) => (
          <p key={i} className="app-secret-line">{l}</p>
        ))}
        <p className="app-secret-line app-secret-cursor">█</p>
      </div>
    </div>
  );
};

const SecretFiles: React.FC<SecretFilesProps> = (props) => {
  const [unlocked, setUnlocked] = useState(false);
  const [attempt, setAttempt] = useState('');
  const [denied, setDenied] = useState(false);

  const tryUnlock = () => {
    if (ANSWER.test(attempt.trim())) {
      setUnlocked(true);
    } else {
      setDenied(true);
      setTimeout(() => setDenied(false), 1600);
    }
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
      bottomLeftText={unlocked ? 'Clearance: granted' : 'Clearance: required'}
    >
      {unlocked ? (
        <MatrixRain />
      ) : (
        <div className="app-secret-lock">
          <img src={lockIcon} alt="" className="app-secret-lock-icon" />
          <p className="app-secret-title">RESTRICTED — AUTHORIZED ACCESS ONLY</p>
          <br />
          <p className="app-secret-question">{QUESTION}</p>
          <br />
          <input
            className="app-secret-input"
            type="text"
            placeholder="Answer"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
          />
          <br />
          <button className="app-win98-button" onMouseDown={tryUnlock}>
            Unlock
          </button>
          <p className="app-secret-denied">{denied ? 'ACCESS DENIED.' : ' '}</p>
        </div>
      )}
    </Window>
  );
};

export default SecretFiles;
