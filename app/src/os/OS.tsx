import React, { useEffect, useState, useRef } from 'react';
import { Minesweeper } from './apps/Minesweeper';
import { Window } from './components/Window';
import './os.css';
import windowsStartIcon from './assets/windowsStartIcon.png';
import volumeOn from './assets/volumeOn.png';

const Colors = {
  white: '#FFFFFF',
  black: '#000000',
  turquoise: '#3e9697',
  lightGray: '#c3c6ca',
  darkGray: '#86898d',
};

export const OS: React.FC = () => {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [windows, setWindows] = useState<{
    [key: string]: { minimized: boolean; zIndex: number; name: string; icon: string }
  }>({});
  const [isSelected, setIsSelected] = useState(false);
  const [doubleClickTimerActive, setDoubleClickTimerActive] = useState(false);
  const [time, setTime] = useState('');
  const lastClickInside = useRef(false);

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
        setIsSelected(false);
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

  const openMinesweeper = () => {
    setWindows(prev => ({
      ...prev,
      minesweeper: { minimized: false, zIndex: getHighestZIndex() + 1, name: 'Minesweeper', icon: '💣' }
    }));
  };

  const closeMinesweeper = () => {
    setWindows(prev => {
      const n = { ...prev };
      delete n.minesweeper;
      return n;
    });
  };

  const minimizeMinesweeper = () => {
    setWindows(prev => ({ ...prev, minesweeper: { ...prev.minesweeper, minimized: true } }));
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

  const handleShortcutClick = () => {
    if (doubleClickTimerActive) {
      openMinesweeper();
      setIsSelected(false);
      setDoubleClickTimerActive(false);
      return;
    }
    setIsSelected(true);
    setDoubleClickTimerActive(true);
    setTimeout(() => setDoubleClickTimerActive(false), 300);
  };

  return (
    <div className="os-desktop" style={{ backgroundColor: Colors.turquoise }}>
      <div className="os-shortcuts">
        <div className="os-shortcut" onMouseDown={handleShortcutClick}>
          <div className="os-shortcut-icon-container">
            {isSelected && <div className="os-shortcut-icon-overlay os-shortcut-selected-overlay" />}
            <div className="os-shortcut-icon">💣</div>
          </div>
          <div className={isSelected ? 'os-shortcut-label-selected' : ''}>
            <p className="os-shortcut-label">Minesweeper</p>
          </div>
        </div>
      </div>

      {windows.minesweeper && (
        <div style={{
          zIndex: windows.minesweeper.zIndex,
          ...(windows.minesweeper.minimized ? { pointerEvents: 'none' as const, opacity: 0 } : {})
        }}>
          <Window
            title="Minesweeper"
            icon="💣"
            onClose={closeMinesweeper}
            onMinimize={minimizeMinesweeper}
          >
            <Minesweeper />
          </Window>
        </div>
      )}

      {startMenuOpen && (
        <div className="os-start-menu" onMouseDown={() => { lastClickInside.current = true; }}>
          <div className="os-start-menu-inner">
            <div className="os-start-sidebar">
              <p className="os-start-sidebar-text">HeffernanOS</p>
            </div>
            <div className="os-start-content">
              <div className="os-start-spacer" />
              <div className="os-start-divider" />
              <div className="os-start-option" onMouseDown={handleShutdown}>
                <div className="os-start-option-icon">🖥️</div>
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
                      <span className="os-tab-icon">{win.icon}</span>
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
    </div>
  );
};
