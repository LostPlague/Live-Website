import React, { useEffect, useState, useRef } from 'react';
import { Minesweeper } from './apps/Minesweeper';
import ShowcaseExplorer from './apps/showcase/ShowcaseExplorer';
import Browser from './apps/Browser';
import Radio from './apps/Radio';
import SecretFiles from './apps/SecretFiles';
import { Window } from './components/Window';
import MatrixTakeover, { type MatrixPhase } from './components/MatrixTakeover';
import { track, trackAppOpen, trackAppClose, flushOpenApps } from '../analytics';
import './os.css';
import windowsStartIcon from './assets/windowsStartIcon.png';
import volumeOn from './assets/volumeOn.png';
import computerBig from './assets/computerBig.png';
import showcaseIcon from './assets/showcaseIcon.png';
import ieIcon from './assets/ieIcon.png';
import radioIcon from './assets/radioIcon.png';
import lockIcon from './assets/lockIcon.png';

const Colors = {
  white: '#FFFFFF',
  black: '#000000',
  turquoise: '#3e9697',
  lightGray: '#c3c6ca',
  darkGray: '#86898d',
};

interface OSWindow {
  minimized: boolean;
  zIndex: number;
  name: string;
  icon: string;        // emoji fallback (our apps)
  iconImg?: string;    // png icon (Henry's apps)
}

export const OS: React.FC = () => {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [windows, setWindows] = useState<{ [key: string]: OSWindow }>({});
  const [selectedShortcut, setSelectedShortcut] = useState<string | null>(null);
  const [doubleClickTimer, setDoubleClickTimer] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const lastClickInside = useRef(false);

  // Matrix takeover: 'idle' → 'glitch' (desktop shreds) → 'matrix' (rain owns
  // the screen) → 'exit' (CRT-off + glitch back) → 'idle'. The OS tree stays
  // mounted throughout, so every open window survives the trip.
  const [matrixPhase, setMatrixPhase] = useState<'idle' | MatrixPhase>('idle');
  const [matrixLevel, setMatrixLevel] = useState<2 | 3>(2);
  const [secretVanished, setSecretVanished] = useState(false);
  const matrixTimer = useRef<number | null>(null);
  const matrixSubjectRef = useRef<HTMLDivElement>(null);

  const enterMatrix = () => {
    if (matrixTimer.current) clearTimeout(matrixTimer.current);
    setMatrixLevel(2);
    setMatrixPhase('glitch');
    matrixTimer.current = window.setTimeout(() => setMatrixPhase('matrix'), 2300);
  };

  // final answer correct → stage 3: the room outside falls too (funnel end)
  const ascendToFinale = () => {
    track('secret_completed');
    setMatrixLevel(3);
  };

  const exitMatrix = () => {
    if (matrixTimer.current) clearTimeout(matrixTimer.current);
    setMatrixPhase('exit');
    matrixTimer.current = window.setTimeout(() => {
      setMatrixPhase('idle');
      setMatrixLevel(2);
      // The Matrix consumes Secret Files on the way back: close its window and
      // remove the desktop app entirely. It's a one-shot — a page refresh
      // restores it for another run. (Stage-1 give-up doesn't come through
      // here — that just closes the window and the app survives.)
      setSecretVanished(true);
      setWindows(prev => {
        const n = { ...prev };
        delete n.secret;
        return n;
      });
    }, 950);
  };

  useEffect(() => () => {
    if (matrixTimer.current) clearTimeout(matrixTimer.current);
  }, []);

  // if the tab closes with apps still open, flush their time-spent durations
  // (beacon transport — a plain capture gets killed mid-flight on unload)
  useEffect(() => {
    const onLeave = () => flushOpenApps(true);
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, []);

  // dev-only hooks for automated verification (mirrors the shell's __roomMatrix)
  useEffect(() => {
    if ((import.meta as any).env?.DEV) {
      (window as any).__osDebug = { enterMatrix, ascendToFinale, exitMatrix };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape pressed on the 3D room side posts 'matrixDismiss' back to the OS —
  // dismiss the takeover (a ref keeps the handler pointed at the latest closure).
  const exitMatrixRef = useRef(exitMatrix);
  exitMatrixRef.current = exitMatrix;
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'matrixDismiss') exitMatrixRef.current();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Bridge: forward window events to parent shell (so MonitorScreen's
  // iframe.onload listener gets them, fixing the hover-stale-state bug)
  useEffect(() => {
    const post = (type: string, data: any = {}) => {
      try { window.parent.postMessage({ type, ...data }, '*'); } catch {}
    };
    const onMouseMove = (e: MouseEvent) => post('mousemove', { clientX: e.clientX, clientY: e.clientY });
    const onMouseDown = (e: MouseEvent) => {
      post('mousedown', { clientX: e.clientX, clientY: e.clientY });
      post('mouseDown'); // existing audio cue
    };
    const onMouseUp = (e: MouseEvent) => {
      post('mouseup', { clientX: e.clientX, clientY: e.clientY });
      post('mouseUp'); // existing audio cue
    };
    const onKeyDown = (e: KeyboardEvent) => {
      post('keydown', { key: e.key });
      post('keyPress'); // existing audio cue
    };
    const onKeyUp = (e: KeyboardEvent) => post('keyup', { key: e.key });

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Clock
  useEffect(() => {
    const getTime = () => {
      const date = new Date();
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const amPm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const mins = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${mins} ${amPm}`;
    };
    setTime(getTime());
    const i = setInterval(() => setTime(getTime()), 5000);
    return () => clearInterval(i);
  }, []);

  // Henry's Start menu click-outside-to-close
  useEffect(() => {
    const onCheckClick = () => {
      if (lastClickInside.current) setStartMenuOpen(true);
      else setStartMenuOpen(false);
      lastClickInside.current = false;
    };
    window.addEventListener('mousedown', onCheckClick, false);
    return () => window.removeEventListener('mousedown', onCheckClick, false);
  }, []);

  const toggleStartMenu = () => { lastClickInside.current = !startMenuOpen; };
  const handleShutdown = () => { setStartMenuOpen(false); /* cosmetic */ };

  // click-outside deselect (attach to window mousedown)
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.os-shortcut')) {
        setSelectedShortcut(null);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, []);

  const getHighestZIndex = () => {
    let max = 0;
    Object.keys(windows).forEach(k => { if (windows[k].zIndex > max) max = windows[k].zIndex; });
    return max;
  };

  const openWindow = (key: string, name: string, icon: string, iconImg?: string) => {
    setWindows(prev => {
      if (!prev[key]) trackAppOpen(key); // count first open, not re-focus
      let max = 0;
      Object.keys(prev).forEach(k => { if (prev[k].zIndex > max) max = prev[k].zIndex; });
      return {
        ...prev,
        [key]: { minimized: false, zIndex: max + 1, name, icon, iconImg },
      };
    });
  };

  const closeWindow = (key: string) => {
    setWindows(prev => {
      if (prev[key]) trackAppClose(key);
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const minimizeWindow = (key: string) => {
    setWindows(prev => ({ ...prev, [key]: { ...prev[key], minimized: true } }));
  };

  const raiseWindow = (key: string) => {
    setWindows(prev => {
      if (!prev[key]) return prev;
      let max = 0;
      Object.keys(prev).forEach(k => { if (prev[k].zIndex > max) max = prev[k].zIndex; });
      if (prev[key].zIndex === max) return prev;
      return { ...prev, [key]: { ...prev[key], zIndex: max + 1 } };
    });
  };

  const toggleMinimize = (key: string) => {
    const newWindows = { ...windows };
    const highestIndex = getHighestZIndex();
    if (newWindows[key].minimized || newWindows[key].zIndex === highestIndex) {
      newWindows[key].minimized = !newWindows[key].minimized;
    }
    newWindows[key].zIndex = getHighestZIndex() + 1;
    setWindows(newWindows);
  };

  const openShowcase = () => openWindow('showcase', 'My Showcase', '', showcaseIcon);
  const openBrowser = () => openWindow('browser', 'Internet Explorer', '', ieIcon);
  const openRadio = () => openWindow('radio', 'Hit Radio', '', radioIcon);
  const openSecretFiles = () => openWindow('secret', 'Secret Files', '', lockIcon);
  const openMinesweeper = () => openWindow('minesweeper', 'Minesweeper', '💣');

  // Henry's Desktop auto-opens My Showcase on boot
  useEffect(() => {
    openShowcase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Henry's double-click-to-open shortcut behavior
  const handleShortcutClick = (key: string, open: () => void) => {
    if (doubleClickTimer === key) {
      open();
      setSelectedShortcut(null);
      setDoubleClickTimer(null);
      return;
    }
    setSelectedShortcut(key);
    setDoubleClickTimer(key);
    setTimeout(() => setDoubleClickTimer(null), 300);
  };

  // Desktop shortcuts, stacked at Henry's `top: i * 104`
  const shortcuts: {
    key: string;
    name: string;
    iconImg?: string;
    iconEmoji?: string;
    open: () => void;
  }[] = [
    { key: 'showcase', name: 'My Showcase', iconImg: showcaseIcon, open: openShowcase },
    { key: 'browser', name: 'Internet Explorer', iconImg: ieIcon, open: openBrowser },
    { key: 'radio', name: 'Hit Radio', iconImg: radioIcon, open: openRadio },
    { key: 'minesweeper', name: 'Minesweeper', iconEmoji: '💣', open: openMinesweeper },
    { key: 'secret', name: 'Secret Files', iconImg: lockIcon, open: openSecretFiles },
  ];

  return (
    <div className="os-desktop" style={{ backgroundColor: Colors.turquoise }}>
      {/* Everything the user normally sees. During a Matrix takeover this whole
          subtree is what the glitch filter shreds — the real, live desktop. */}
      <div className="os-subject" ref={matrixSubjectRef}>
      <div className="os-shortcuts">
        {shortcuts.filter(sc => !(sc.key === 'secret' && secretVanished)).map((sc, i) => (
          <div key={sc.key} style={{ position: 'absolute', top: i * 104 }}>
            <div className="os-shortcut" onMouseDown={() => handleShortcutClick(sc.key, sc.open)}>
              <div className="os-shortcut-icon-container">
                {selectedShortcut === sc.key && (
                  <div className="os-shortcut-icon-overlay os-shortcut-selected-overlay" />
                )}
                {sc.iconImg ? (
                  <img src={sc.iconImg} alt="" className="os-shortcut-icon-img" draggable={false} />
                ) : (
                  <div className="os-shortcut-icon">{sc.iconEmoji}</div>
                )}
              </div>
              <div className={selectedShortcut === sc.key ? 'os-shortcut-label-selected' : ''}>
                <p className="os-shortcut-label">{sc.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {windows.showcase && (
        <div
          style={{
            zIndex: windows.showcase.zIndex,
            ...(windows.showcase.minimized ? { pointerEvents: 'none' as const, opacity: 0 } : {}),
          }}
          onMouseDown={() => raiseWindow('showcase')}
        >
          <ShowcaseExplorer
            onClose={() => closeWindow('showcase')}
            onMinimize={() => minimizeWindow('showcase')}
          />
        </div>
      )}

      {windows.browser && (
        <div
          style={{
            zIndex: windows.browser.zIndex,
            ...(windows.browser.minimized ? { pointerEvents: 'none' as const, opacity: 0 } : {}),
          }}
          onMouseDown={() => raiseWindow('browser')}
        >
          <Browser
            onClose={() => closeWindow('browser')}
            onMinimize={() => minimizeWindow('browser')}
          />
        </div>
      )}

      {windows.radio && (
        <div
          style={{
            zIndex: windows.radio.zIndex,
            ...(windows.radio.minimized ? { pointerEvents: 'none' as const, opacity: 0 } : {}),
          }}
          onMouseDown={() => raiseWindow('radio')}
        >
          <Radio
            onClose={() => closeWindow('radio')}
            onMinimize={() => minimizeWindow('radio')}
          />
        </div>
      )}

      {windows.secret && (
        <div
          style={{
            zIndex: windows.secret.zIndex,
            ...(windows.secret.minimized ? { pointerEvents: 'none' as const, opacity: 0 } : {}),
          }}
          onMouseDown={() => raiseWindow('secret')}
        >
          <SecretFiles
            onClose={() => closeWindow('secret')}
            onMinimize={() => minimizeWindow('secret')}
            onEnterMatrix={enterMatrix}
          />
        </div>
      )}

      {windows.minesweeper && (
        <div
          style={{
            zIndex: windows.minesweeper.zIndex,
            ...(windows.minesweeper.minimized ? { pointerEvents: 'none' as const, opacity: 0 } : {}),
          }}
          onMouseDown={() => raiseWindow('minesweeper')}
        >
          <Window
            title="Minesweeper"
            icon="💣"
            onClose={() => closeWindow('minesweeper')}
            onMinimize={() => minimizeWindow('minesweeper')}
          >
            <Minesweeper />
          </Window>
        </div>
      )}

      {startMenuOpen && (
        <div className="os-start-menu" onMouseDown={() => { lastClickInside.current = true; }}>
          <div className="os-start-menu-inner">
            <div className="os-start-sidebar">
              <p className="os-start-sidebar-text">TabariOS</p>
            </div>
            <div className="os-start-content">
              <div className="os-start-spacer" />
              <div className="os-start-divider" />
              <div className="os-start-option" onMouseDown={handleShutdown}>
                <div className="os-start-option-icon"><img src={computerBig} alt="" className="os-start-option-icon-img" /></div>
                <p className="os-start-option-text">Sh<u>u</u>t down...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="os-toolbar-outer">
        <div className="os-toolbar-inner">
          <div className="os-toolbar">
            <div
              className={`os-start-button-outer ${startMenuOpen ? 'os-active-tab-outer' : ''}`}
              onMouseDown={toggleStartMenu}
            >
              <div className={`os-start-button-inner ${startMenuOpen ? 'os-active-tab-inner' : ''}`}>
                <img src={windowsStartIcon} alt="Start" className="os-start-icon-img" />
                <p className="os-toolbar-text"><u>S</u>tart</p>
              </div>
            </div>
            <div className="os-tabs-container">
              {Object.keys(windows).map(key => {
                const win = windows[key];
                const isActive = !win.minimized && win.zIndex === getHighestZIndex();
                return (
                  <div
                    key={key}
                    className={`os-tab-outer ${isActive ? 'os-active-tab-outer' : ''}`}
                    onMouseDown={() => toggleMinimize(key)}
                  >
                    <div className={`os-tab-inner ${isActive ? 'os-active-tab-inner' : ''}`}>
                      {win.iconImg ? (
                        <img src={win.iconImg} alt="" className="os-tab-icon-img" />
                      ) : (
                        <span className="os-tab-icon">{win.icon}</span>
                      )}
                      <p className="os-tab-text">{win.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="os-time">
            <img src={volumeOn} alt="Volume" className="os-volume-icon-img" />
            <p className="os-time-text">{time}</p>
          </div>
        </div>
      </div>
      </div>{/* /os-subject */}

      {matrixPhase !== 'idle' && (
        <MatrixTakeover
          phase={matrixPhase}
          level={matrixLevel}
          subjectRef={matrixSubjectRef}
          onReenter={exitMatrix}
          onFinalUnlock={ascendToFinale}
        />
      )}
    </div>
  );
};
