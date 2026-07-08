import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface HUDOverlayProps {
  onMuteToggle: (muted: boolean) => void;
  isMuted: boolean;
  onFreeCamToggle: () => void;
  isOrbit: boolean;
  /** false while the camera is in the monitor view — HUD slides out (Henry's InterfaceUI) */
  visible: boolean;
}

// Henry's InterfaceUI.tsx `vars` — verbatim
const hudVariants = {
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, delay: 0.3, ease: 'easeOut' as const },
  },
  hide: {
    x: -32,
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
};

const NAME_TEXT = 'Mohamed Tabari';
const TITLE_TEXT = 'Software QA Engineer';

/**
 * Ported 1:1 from Henry's InfoOverlay.tsx.
 * Structure: 3 black <div> containers in column layout.
 * Each container: background: black, padding: 4px 16px, marginBottom: 4, NO border-radius.
 * Typewriter: Math.random() * 50 + 50 ms per char (variable speed).
 * Sequence: Name → Title → Time → 250ms → Volume icon → 250ms → FreeCam icon.
 */
export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  onMuteToggle,
  isMuted,
  onFreeCamToggle,
  isOrbit,
  visible,
}) => {
  const [nameText, setNameText] = useState('');
  const [titleText, setTitleText] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const timeRef = useRef(time);
  const [timeText, setTimeText] = useState('');
  const [textDone, setTextDone] = useState(false);
  const [volumeVisible, setVolumeVisible] = useState(false);
  const [freeCamVisible, setFreeCamVisible] = useState(false);

  // Icon hover/active states — matches Henry's FreeCamToggle & MuteToggle
  const [muteHover, setMuteHover] = useState(false);
  const [muteActive, setMuteActive] = useState(false);
  const [fcHover, setFcHover] = useState(false);
  const [fcActive, setFcActive] = useState(false);

  // Henry's recursive typeText — variable speed: Math.random() * 50 + 50
  const typeText = (
    i: number,
    curText: string,
    text: string,
    setText: React.Dispatch<React.SetStateAction<string>>,
    callback: () => void,
    refOverride?: React.MutableRefObject<string>
  ) => {
    if (refOverride) {
      text = refOverride.current;
    }
    if (i < text.length) {
      setTimeout(() => {
        setText(curText + text[i]);
        // Henry plays a "ccType" tick per typed char. Route it through the audio
        // manager (which owns the WebAudio context and applies Henry's exact
        // config: volume 0.1, detune 2000 cents) via the same postMessage bridge.
        window.postMessage({ type: 'ccType' }, '*');
        typeText(i + 1, curText + text[i], text, setText, callback, refOverride);
      }, Math.random() * 50 + 50);
    } else {
      callback();
    }
  };

  // Boot sequence: 400ms delay → type Name → type Title → type Time → done
  useEffect(() => {
    const timer = setTimeout(() => {
      typeText(0, '', NAME_TEXT, setNameText, () => {
        typeText(0, '', TITLE_TEXT, setTitleText, () => {
          typeText(0, '', time, setTimeText, () => {
            setTextDone(true);
          }, timeRef);
        });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // After text done: 250ms → volume visible → 250ms → freeCam visible
  useEffect(() => {
    if (textDone) {
      const t1 = setTimeout(() => {
        setVolumeVisible(true);
        const t2 = setTimeout(() => {
          setFreeCamVisible(true);
        }, 250);
        return () => clearTimeout(t2);
      }, 250);
      return () => clearTimeout(t1);
    }
  }, [textDone]);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync timeText after typing is done
  useEffect(() => {
    timeRef.current = time;
    if (textDone) setTimeText(time);
  }, [time]);



  return (
    <motion.div
      initial="hide"
      variants={hudVariants}
      animate={visible ? 'visible' : 'hide'}
      style={{ ...styles.wrapper, pointerEvents: visible ? 'auto' : 'none' }}
    >
      {nameText !== '' && (
        <div style={styles.container} id="prevent-click">
          <p style={{ margin: 0 }}>{nameText}</p>
        </div>
      )}
      {titleText !== '' && (
        <div style={styles.container} id="prevent-click">
          <p style={{ margin: 0 }}>{titleText}</p>
        </div>
      )}
      {timeText !== '' && (
        <div style={styles.lastRow}>
          <div style={{ ...styles.container, ...styles.lastRowChild }} id="prevent-click">
            <p style={{ margin: 0 }}>{timeText}</p>
          </div>
          {volumeVisible && (
            <div
              style={{ ...styles.iconContainer, ...styles.lastRowChild }}
              className="icon-control-container"
              id="prevent-click"
              onMouseEnter={() => setMuteHover(true)}
              onMouseLeave={() => setMuteHover(false)}
              onMouseDown={(e) => {
                e.preventDefault();
                setMuteActive(true);
                onMuteToggle(!isMuted);
              }}
              onMouseUp={() => setMuteActive(false)}
            >
              <img
                id="prevent-click"
                src={isMuted ? '/textures/UI/volume_off.svg' : '/textures/UI/volume_on.svg'}
                width={window.innerWidth < 768 ? 8 : 10}
                style={{
                  opacity: muteActive ? 0.2 : muteHover ? 0.8 : 1,
                  transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
                  transform: muteActive ? 'scale(0.8)' : 'scale(1)',
                }}
                alt={isMuted ? 'Unmute' : 'Mute'}
              />
            </div>
          )}
          {freeCamVisible && (
            <div
              style={{ ...styles.iconContainer, ...styles.lastRowChild }}
              className="icon-control-container"
              id="prevent-click"
              onMouseEnter={() => setFcHover(true)}
              onMouseLeave={() => setFcHover(false)}
              onMouseDown={(e) => {
                e.preventDefault();
                setFcActive(true);
                onFreeCamToggle();
              }}
              onMouseUp={() => setFcActive(false)}
            >
              <img
                id="prevent-click"
                src={isOrbit ? '/textures/UI/mouse.svg' : '/textures/UI/camera.svg'}
                height={isOrbit ? (window.innerWidth < 768 ? 8 : 10) : (window.innerWidth < 768 ? 4 : 6)}
                style={{
                  opacity: fcActive ? 0.2 : fcHover ? 0.8 : 1,
                  transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
                  transform: fcActive ? 'scale(0.8)' : 'scale(1)',
                }}
                alt={isOrbit ? 'Exit Free-Cam' : 'Free-Cam'}
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

/* ─── Inline styles — ported 1:1 from Henry's InfoOverlay.tsx ─── */
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'black',
    padding: 4,
    paddingLeft: 16,
    paddingRight: 16,
    textAlign: 'center',
    display: 'flex',
    marginBottom: 4,
    boxSizing: 'border-box',
    color: 'white',
  },
  wrapper: {
    position: 'absolute',
    top: window.innerWidth < 768 ? 24 : 64,
    left: window.innerWidth < 768 ? 24 : 64,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    zIndex: 100,
    pointerEvents: 'auto',
  },
  lastRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  lastRowChild: {
    marginRight: 4,
  },
  iconContainer: {
    background: 'black',
    width: window.innerWidth < 768 ? 19.5 : 26.5,
    height: window.innerWidth < 768 ? 19.5 : 26.5,
    display: 'flex',
    boxSizing: 'border-box',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
};
