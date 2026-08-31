import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import Link from './Link';
import type { StyleSheetCSS } from './types';

// Ported verbatim from Henry's components/showcase/VerticalNavbar.tsx
// (PROJECTS link + expanded sublinks removed per Med's directive)

export interface VerticalNavbarProps {}

const VerticalNavbar: React.FC<VerticalNavbarProps> = () => {
  const location = useLocation();
  const [isHome, setIsHome] = useState(false);

  const navigate = useNavigate();
  const goToContact = () => {
    navigate('/os/contact');
  };

  useEffect(() => {
    // Henry checks pathname === '/' — our showcase root is /os
    if (location.pathname === '/os' || location.pathname === '/os/') {
      setIsHome(true);
    } else {
      setIsHome(false);
    }
    return () => {};
  }, [location.pathname]);

  return !isHome ? (
    // classNames exist so the mobile rules in os.css can override these inline
    // styles (inline wins over CSS, so those rules use !important).
    <div className="site-navbar" style={styles.navbar}>
      <div className="site-navbar-header" style={styles.header}>
        <h1 style={styles.headerText}>Mohamed</h1>
        <h1 style={styles.headerText}>Tabari</h1>
        <h3 style={styles.headerShowcase}>Showcase '25</h3>
      </div>
      <div className="site-navbar-links" style={styles.links}>
        <Link containerStyle={styles.link} to="" text="HOME" />
        <Link containerStyle={styles.link} to="about" text="ABOUT" />
        <Link containerStyle={styles.link} to="experience" text="EXPERIENCE" />
        <Link containerStyle={styles.link} to="contact" text="CONTACT" />
      </div>
      <div style={styles.spacer} />
      <div style={styles.forHireContainer} onMouseDown={goToContact} />
    </div>
  ) : (
    <></>
  );
};

const styles: StyleSheetCSS = {
  navbar: {
    width: 300,
    height: '100%',
    flexDirection: 'column',
    padding: 48,
    boxSizing: 'border-box',
    position: 'fixed',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'column',
    marginBottom: 64,
  },
  headerText: {
    fontSize: 38,
    lineHeight: 1,
  },
  headerShowcase: {
    marginTop: 12,
  },
  link: {
    marginBottom: 32,
  },
  links: {
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  forHireContainer: {
    cursor: 'pointer',
    width: '100%',
  },
};

export default VerticalNavbar;
