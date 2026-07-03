import React, { useEffect, useRef, useState } from 'react';
import { Window } from '../components/Window';
import radioIcon from '../assets/radioIcon.png';

// Win98-style radio tuned to Hit Radio (Morocco). Their website blocks
// iframing (X-Frame-Options: DENY), so this plays their official live audio
// stream directly instead — verified: HTTP 200, audio/mpeg.

const STREAM_URL = 'https://hitradio.ice.infomaniak.ch/hitradio.mp3';

export interface RadioProps {
  onClose: () => void;
  onMinimize: () => void;
}

const Radio: React.FC<RadioProps> = (props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<'stopped' | 'buffering' | 'playing'>('stopped');
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    return () => {
      // stop the stream when the window closes
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const play = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(STREAM_URL);
      audioRef.current.volume = volume;
      audioRef.current.onplaying = () => setStatus('playing');
      audioRef.current.onwaiting = () => setStatus('buffering');
      audioRef.current.onerror = () => setStatus('stopped');
    }
    setStatus('buffering');
    audioRef.current.play().catch(() => setStatus('stopped'));
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setStatus('stopped');
  };

  const onVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <Window
      initialTop={320}
      initialLeft={420}
      initialWidth={420}
      initialHeight={260}
      title="Hit Radio - Live"
      iconSrc={radioIcon}
      onClose={props.onClose}
      onMinimize={props.onMinimize}
      bottomLeftText={status === 'playing' ? 'On air' : 'Ready'}
    >
      <div className="app-radio">
        <div className="app-radio-display">
          <p className="app-radio-freq">HIT RADIO</p>
          <p className="app-radio-status">
            {status === 'playing' && '● LIVE'}
            {status === 'buffering' && '· · · tuning · · ·'}
            {status === 'stopped' && '— stopped —'}
          </p>
        </div>
        <div className="app-radio-controls">
          <button className="app-win98-button" onMouseDown={play} disabled={status !== 'stopped'}>
            ► Play
          </button>
          <button className="app-win98-button" onMouseDown={stop} disabled={status === 'stopped'}>
            ■ Stop
          </button>
          <div className="app-radio-volume">
            <p className="app-radio-vol-label">Vol</p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolume(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    </Window>
  );
};

export default Radio;
