import React, { useState } from 'react';
import { Window } from '../components/Window';
import lockIcon from '../assets/lockIcon.png';

// Secret Files — locked Win98 dialog. The correct answer fires onEnterMatrix(),
// which the OS root uses to glitch the ENTIRE desktop into the Matrix. On the
// way back the OS closes this window and removes the app, so it's a one-shot.

const QUESTION = 'What is the most valuable resource in the AI world?';
const ANSWER = /^tokens?$/i;

export interface SecretFilesProps {
  onClose: () => void;
  onMinimize: () => void;
  /** fires the full-OS Matrix takeover (owned by OS.tsx) */
  onEnterMatrix: () => void;
}

const SecretFiles: React.FC<SecretFilesProps> = (props) => {
  const [attempt, setAttempt] = useState('');
  const [denied, setDenied] = useState(false);

  const tryUnlock = () => {
    if (ANSWER.test(attempt.trim())) {
      props.onEnterMatrix();
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
      bottomLeftText="Clearance: required"
    >
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
        <p className="app-secret-denied">{denied ? 'ACCESS DENIED.' : ' '}</p>
      </div>
    </Window>
  );
};

export default SecretFiles;
