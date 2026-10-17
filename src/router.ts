import { useEffect, useState } from 'react';

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

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash());
  useEffect(() => {
    const on = () => { setR(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
