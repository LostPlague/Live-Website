import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Window } from '../../components/Window';
import { trackSectionEnter, flushSection, updateSectionScroll } from '../../../analytics';
import windowExplorerIcon from '../../assets/windowExplorerIcon.png';
import Home from './Home';
import About from './About';
import Experience from './Experience';
import Contact from './Contact';
import VerticalNavbar from './VerticalNavbar';

// Ported from Henry's components/applications/ShowcaseExplorer.tsx.
// Deltas from his source, both deliberate:
//  - No nested <Router>: react-router v6 throws on ANY router-in-router.
//    We use descendant <Routes> on the app's existing BrowserRouter — the
//    /os/* splat route already exists, so pages live at /os/about etc.
//    (mirrors Henry's iframe URL changing / → /about on his site).
//  - Projects routes removed per Med's directive.

export interface ShowcaseExplorerProps {
  onClose: () => void;
  onMinimize: () => void;
}

const ShowcaseExplorer: React.FC<ShowcaseExplorerProps> = (props) => {
  // Henry's useInitialWindowSize({ margin: 100 })
  const initWidth = window.innerWidth - 100;
  const initHeight = window.innerHeight - 100;

  // Section reading time: pages are routes, so the pathname IS the section.
  // Enter starts the clock; route change / window close / tab close flush it.
  const { pathname } = useLocation();
  useEffect(() => {
    const section = pathname.replace(/^\/os\/?/, '').replace(/\/$/, '') || 'home';
    trackSectionEnter(section);
  }, [pathname]);
  useEffect(() => () => flushSection(), []);

  return (
    <Window
      initialTop={24}
      initialLeft={56}
      initialWidth={initWidth}
      initialHeight={initHeight}
      // Derived, not hardcoded: this read "2025" until September 2026, on the
      // page recruiters land on. A date that ages badly should never be a
      // literal. Same for the year in VerticalNavbar.
      title={`Mohamed Tabari - Showcase ${new Date().getFullYear()}`}
      iconSrc={windowExplorerIcon}
      onClose={props.onClose}
      onMinimize={props.onMinimize}
      bottomLeftText={`© Copyright ${new Date().getFullYear()} Mohamed Tabari`}
    >
      <div
        className="site-page"
        // scroll events don't bubble but DO capture — one listener covers
        // whichever inner container actually scrolls. Records the deepest
        // point reached in the active section (0–100%).
        onScrollCapture={(e) => {
          const el = e.target as HTMLElement;
          if (el && el.scrollHeight > el.clientHeight) {
            updateSectionScroll(Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100));
          }
        }}
      >
        <VerticalNavbar />
        <Routes>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="experience" element={<Experience />} />
          <Route path="contact" element={<Contact />} />
        </Routes>
      </div>
    </Window>
  );
};

export default ShowcaseExplorer;
