import React, { useState } from 'react';
import './Window.css';

interface WindowProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  initialTop?: number;
  initialLeft?: number;
  initialWidth?: number;
  initialHeight?: number;
}

export const Window: React.FC<WindowProps> = ({
  title, icon, children, onClose, onMinimize,
  initialTop, initialLeft, initialWidth, initialHeight
}) => {
  const defaultWidth = initialWidth ?? 300;
  const defaultHeight = initialHeight ?? 400;
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
      setHeight(window.innerHeight - 32);
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
      }}
    >
      <div className="os-window-border-outer" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="os-window-border-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="os-window-titlebar">
            <div className="os-window-titlebar-text">
              {icon && <span className="os-window-titlebar-icon">{icon}</span>}
              <span>{title}</span>
            </div>
            <div className="os-window-titlebar-buttons">
              <button className="os-window-btn" onClick={onMinimize} title="Minimize">_</button>
              <button className="os-window-btn" onClick={maximize} title="Maximize">□</button>
              <button className="os-window-btn os-window-btn-close" onClick={onClose} title="Close">×</button>
            </div>
          </div>
          <div
            className="os-window-content"
            data-maximized={isMaximized}
            style={{ flex: 1, overflow: 'auto', background: 'white' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
