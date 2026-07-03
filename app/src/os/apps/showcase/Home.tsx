import React from 'react';
import { useNavigate } from 'react-router';
import Link from './Link';
import type { StyleSheetCSS } from './types';

// Ported verbatim from Henry's components/showcase/Home.tsx
// (PROJECTS link removed per Med's directive)

export interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const navigate = useNavigate();

  const goToContact = () => {
    navigate('/os/contact');
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.name}>Mohamed Tabari</h1>
        <h2>Software QA Engineer</h2>
      </div>
      <div style={styles.buttons}>
        <Link containerStyle={styles.link} to="about" text="ABOUT" />
        <Link containerStyle={styles.link} to="experience" text="EXPERIENCE" />
        <Link containerStyle={styles.link} to="contact" text="CONTACT" />
      </div>
      <div style={styles.forHireContainer} onMouseDown={goToContact} />
    </div>
  );
};

const styles: StyleSheetCSS = {
  page: {
    left: 0,
    right: 0,
    top: 0,
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    textAlign: 'center',
    marginBottom: 64,
    marginTop: 64,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: {
    justifyContent: 'space-between',
  },
  link: {
    padding: 16,
  },
  forHireContainer: {
    marginTop: 64,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  name: {
    fontSize: 72,
    marginBottom: 16,
    lineHeight: 0.9,
  },
};

export default Home;
