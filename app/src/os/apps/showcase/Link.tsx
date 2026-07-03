import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import type { StyleSheetCSS } from './types';

// Ported verbatim from Henry's components/general/Link.tsx

export interface LinkProps {
  text: string;
  to: string;
  containerStyle?: React.CSSProperties;
}

/* Henry's routes live at the domain root; ours live under /os (descendant
   Routes on the app router). BASE keeps his `/${to}` semantics intact. */
const BASE = '/os';

const Link: React.FC<LinkProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHere, setIsHere] = useState(false);
  const [active, setActive] = useState(false);

  const target = props.to ? `${BASE}/${props.to}` : BASE;

  useEffect(() => {
    if (location.pathname === target || location.pathname === `${target}/`) {
      setIsHere(true);
    } else {
      setIsHere(false);
    }
    return () => {};
  }, [location, target]);

  const handleClick = (e: React.MouseEvent) => {
    let isMounted = true;
    e.preventDefault();
    setActive(true);
    if (location.pathname !== target) {
      setTimeout(() => {
        if (isMounted) navigate(target);
      }, 100);
    }
    const t = setTimeout(() => {
      if (isMounted) setActive(false);
    }, 100);
    return () => {
      isMounted = false;
      clearTimeout(t);
    };
  };

  return (
    <RouterLink
      to={target}
      onMouseDown={handleClick}
      style={Object.assign({}, { display: 'flex' }, props.containerStyle)}
    >
      {isHere && <div style={styles.hereIndicator} />}
      <h4
        className="router-link"
        style={Object.assign({}, styles.link, active && { color: 'red' })}
      >
        {props.text}
      </h4>
    </RouterLink>
  );
};

const styles: StyleSheetCSS = {
  link: {
    cursor: 'pointer',
    fontWeight: 'bolder',
    textDecoration: 'underline',
  },
  hereIndicator: {
    width: 4,
    height: 4,
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: 'rgb(85, 26, 139)',
    alignSelf: 'center',
    borderRadius: '50%',
    marginRight: 6,
    textDecoration: 'none',
  },
};

export default Link;
