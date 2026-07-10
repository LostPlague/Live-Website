import React, { useEffect, useRef, useState } from 'react';
import { Window } from '../components/Window';
import radioIcon from '../assets/radioIcon.png';
import { track } from '../../analytics';

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
  const listenStartRef = useRef<number | null>(null);
  const volAdjustsRef = useRef(0);
  const lastVolAtRef = useRef(0);
  const [status, setStatus] = useState<'stopped' | 'buffering' | 'playing'>('stopped');
  const [volume, setVolume] = useState(0.8);
  const volumeRef = useRef(volume);

  // how long the stream actually played (start → stop/close), in seconds —
  // plus how they treated the volume (adjust bursts, final level, mute)
  const flushListen = () => {
    if (listenStartRef.current == null) return;
    const seconds = Math.round((Date.now() - listenStartRef.current) / 1000);
    listenStartRef.current = null;
    if (seconds > 0) {
      track('radio_listened', {
        seconds,
        endVolume: Math.round(volumeRef.current * 100) / 100,
        volumeAdjusts: volAdjustsRef.current || undefined,
        muted: volumeRef.current === 0 || undefined,
      });
    }
    volAdjustsRef.current = 0;
  };

  useEffect(() => {
    return () => {
      // stop the stream when the window closes
      flushListen();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    track('radio_play');
    listenStartRef.current = Date.now();
    audioRef.current.play().catch(() => { setStatus('stopped'); listenStartRef.current = null; });
  };

  const stop = () => {
    flushListen();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setStatus('stopped');
  };

  const onVolume = (v: number) => {
    setVolume(v);
    volumeRef.current = v;
    if (audioRef.current) audioRef.current.volume = v;
    // a slider drag fires dozens of change events — count bursts, not steps
    const now = Date.now();
    if (now - lastVolAtRef.current > 800) volAdjustsRef.current += 1;
    lastVolAtRef.current = now;
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
