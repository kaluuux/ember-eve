import { useEffect, useRef, useState } from 'react';

export interface Route { name: string; arg: string; q: Record<string, string> }

export function parseHash(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, '');
  const i = h.indexOf('?');
  const path = i < 0 ? h : h.slice(0, i);
  const q: Record<string, string> = {};
  new URLSearchParams(i < 0 ? '' : h.slice(i + 1)).forEach((v, k) => { q[k] = v; });
  const parts = path.split('/');
  return { name: parts[0] || 'home', arg: parts[1] || '', q };
}

export function go(path: string) {
  location.hash = '#/' + path.replace(/^\/+/, '');
}

/* ---------------------------------------------------------------- scroll memory
 * Each page (full hash, including its filters) remembers where you were. Going back to it,
 * by the browser Back button or any link, returns you there. New pages start at the top. */
const SCROLL_KEY = 'ee_scroll';
const readPos = (): Record<string, number> => {
  try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}'); } catch { return {}; }
};
const savePos = (hash: string) => {
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ ...readPos(), [hash]: Math.round(window.scrollY) })); } catch { /* ignore */ }
};

/** Content may still be loading (products arrive from the server), so keep trying briefly until the page is tall enough. */
function restoreScroll(y: number) {
  let tries = 0;
  const step = () => {
    window.scrollTo({ top: y, behavior: 'instant' });
    if (y > 0 && Math.abs(window.scrollY - y) > 2 && tries++ < 30) window.setTimeout(step, 50);
  };
  step();
}

/** Read-only current route (no scroll handling), for things like highlighting the active nav tab. */
export function useCurrentRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash());
  useEffect(() => {
    const on = () => setR(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash());
  const hash = useRef(location.hash);
  const target = useRef(readPos()[location.hash] ?? 0);

  useEffect(() => {
    history.scrollRestoration = 'manual';
    const on = () => {
      savePos(hash.current);
      hash.current = location.hash;
      target.current = readPos()[location.hash] ?? 0;
      setR(parseHash());
    };
    const leave = () => savePos(hash.current);
    window.addEventListener('hashchange', on);
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('pagehide', leave); };
  }, []);

  useEffect(() => { restoreScroll(target.current); }, [r]);
  return r;
}
