import React, { useState } from 'react';
import './Window.css';
import minimizeIcon from '../assets/minimize.png';
import maximizeIcon from '../assets/maximize.png';
import closeIcon from '../assets/close.png';
import windowResizeIcon from '../assets/windowResize.png';

interface WindowProps {
  title: string;
  icon?: string;
  /** png icon for the title bar (Henry's windowBarIcon) — takes priority over `icon` */
  iconSrc?: string;
  bottomLeftText?: string;
  children: React.ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  initialTop?: number;
  initialLeft?: number;
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * Title-bar button — Henry's Button.tsx verbatim geometry:
 * outer 16×14 content-box (1px black border, top/left white), inner fills
 * (1px darkGray border, top/left lightGray), hover → inner bg darkGray.
 * Icons are Henry's actual 12×10 pngs extracted from his deployed bundle.
 */
const TitleBarButton: React.FC<{ src: string; alt: string; onClick: () => void }> = ({
  src, alt, onClick,
}) => (
  <div
    className="os-window-btn-outer"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
  >
    <div className="os-window-btn-inner">
      <img src={src} alt={alt} className="os-window-btn-img" />
    </div>
  </div>
);

export const Window: React.FC<WindowProps> = ({
  title, icon, iconSrc, bottomLeftText, children, onClose, onMinimize,
  initialTop, initialLeft, initialWidth, initialHeight
}) => {
  const defaultWidth = initialWidth ?? 520;   // Henry's resize floor is 520×220
  const defaultHeight = initialHeight ?? 420;
  const defaultLeft = initialLeft ?? Math.round(window.innerWidth / 2 - defaultWidth / 2);
  const defaultTop = initialTop ?? Math.round(window.innerHeight / 2 - defaultHeight / 2 - 16);

  const [top, setTop] = useState(defaultTop);
  const [left, setLeft] = useState(defaultLeft);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxSize, setPreMaxSize] = useState({ top: defaultTop, left: defaultLeft, width: defaultWidth, height: defaultHeight });

  const maximize = () => {
    if (isMaximized) {
      setTop(preMaxSize.top);
      setLeft(preMaxSize.left);
      setWidth(preMaxSize.width);
      setHeight(preMaxSize.height);
      setIsMaximized(false);
    } else {
      setPreMaxSize({ top, left, width, height });
      setTop(0);
      setLeft(0);
      setWidth(window.innerWidth);
      setHeight(window.innerHeight - 32);   // Henry: winH - 32 (toolbar)
      setIsMaximized(true);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        height,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#c3c6ca',   // Henry: window bg lightGray
      }}
    >
      <div className="os-window-border-outer">
        <div className="os-window-border-inner">
          <div className="os-window-titlebar">
            <div className="os-window-header">
              {iconSrc ? (
                <img src={iconSrc} alt="" className="os-window-titlebar-icon" />
              ) : icon ? (
                <span className="os-window-titlebar-icon">{icon}</span>
              ) : (
                <div style={{ width: 16 }} />
              )}
              <p className="showcase-header">{title}</p>
            </div>
            <div className="os-window-topbuttons">
              <TitleBarButton src={minimizeIcon} alt="Minimize" onClick={onMinimize} />
              <TitleBarButton src={maximizeIcon} alt="Maximize" onClick={maximize} />
              <div style={{ paddingLeft: 2, display: 'flex' }}>
                <TitleBarButton src={closeIcon} alt="Close" onClick={onClose} />
              </div>
            </div>
          </div>
          <div className="os-window-content-outer">
            <div className="os-window-content-inner">
              <div className="os-window-content" data-maximized={isMaximized}>
                {children}
              </div>
            </div>
          </div>
          <div className="os-window-bottombar">
            <div className="os-inset-border os-bottom-left">
              <p className="os-bottom-left-text">{bottomLeftText}</p>
            </div>
            <div className="os-inset-border os-bottom-spacer" />
            <div className="os-inset-border os-bottom-spacer" />
            <div className="os-inset-border os-bottom-resize">
              <div className="os-bottom-resize-inner">
                <img src={windowResizeIcon} alt="" width={12} height={12} className="os-window-btn-img" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
