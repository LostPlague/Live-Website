import React from 'react';
import { Window } from '../components/Window';
import ieIcon from '../assets/ieIcon.png';

// "Internet Explorer" — Win98-style browser window locked to profectra.com.
// The address bar is read-only (URL can't be changed), but the visitor can
// navigate freely WITHIN the site inside the iframe. profectra.com verified
// embeddable (no X-Frame-Options / frame-ancestors headers).

const HOME_URL = 'https://www.profectra.com';

export interface BrowserProps {
  onClose: () => void;
  onMinimize: () => void;
}

const Browser: React.FC<BrowserProps> = (props) => {
  const initWidth = window.innerWidth - 160;
  const initHeight = window.innerHeight - 160;

  return (
    <Window
      initialTop={56}
      initialLeft={104}
      initialWidth={initWidth}
      initialHeight={initHeight}
      title="Profectra - Microsoft Internet Explorer"
      iconSrc={ieIcon}
      onClose={props.onClose}
      onMinimize={props.onMinimize}
      bottomLeftText={'Done'}
    >
      <div className="app-ie">
        <div className="app-ie-toolbar">
          <p className="app-ie-address-label">Address</p>
          <input
            className="app-ie-address"
            type="text"
            value={HOME_URL}
            readOnly
            onFocus={(e) => e.target.blur()}
          />
        </div>
        <iframe
          className="app-ie-frame"
          src={HOME_URL}
          title="Profectra"
          frameBorder="0"
        />
      </div>
    </Window>
  );
};

export default Browser;
