import { useEffect, useRef, useState } from 'react';

export interface Route { name: string; arg: string; q: Record<string, string> }

/** Real URLs (/shop?cat=mold, /product/4). */
export function parseLocation(path = location.pathname, search = location.search): Route {
  const parts = path.replace(/^\/+|\/+$/g, '').split('/');
  const q: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => { q[k] = v; });
  return { name: parts[0] || 'home', arg: parts[1] || '', q };
}

const NAV = 'ee-nav';

/** Move to another page without reloading. Accepts 'shop?cat=mold' or '/shop?cat=mold'. */
export function go(path: string) {
  const url = '/' + path.replace(/^\/+/, '');
  if (url === location.pathname + location.search) return;
  history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV));
}

/** Old links used #/shop; turn them into real URLs so shared bookmarks keep working. */
export function upgradeLegacyHash() {
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1));
}

/** Turn ordinary same-site <a href="/..."> clicks into in-app navigation (no full reload). */
export function installLinkInterceptor() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    go(href);
  });
}

/** Read-only current route (no scroll handling), for things like highlighting the active nav tab. */
export function useCurrentRoute(): Route {
  const [r, setR] = useState<Route>(() => parseLocation());
  useEffect(() => {
    const on = () => setR(parseLocation());
    window.addEventListener('popstate', on);
    window.addEventListener(NAV, on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(NAV, on); };
  }, []);
  return r;
}

/* ---------------------------------------------------------------- scroll memory
 * Each page (full URL, including its filters) remembers where you were. Going back to it,
 * by the browser Back button or any link, returns you there. New pages start at the top. */
const SCROLL_KEY = 'ee_scroll';
const here = () => location.pathname + location.search;
const readPos = (): Record<string, number> => {
  try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}'); } catch { return {}; }
};
const savePos = (key: string) => {
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ ...readPos(), [key]: Math.round(window.scrollY) })); } catch { /* ignore */ }
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

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseLocation());
  const key = useRef(here());
  const target = useRef(readPos()[here()] ?? 0);

  useEffect(() => {
    history.scrollRestoration = 'manual';
    const on = () => {
      savePos(key.current);
      key.current = here();
      target.current = readPos()[here()] ?? 0;
      setR(parseLocation());
    };
    const leave = () => savePos(key.current);
    window.addEventListener('popstate', on);
    window.addEventListener(NAV, on);
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(NAV, on); window.removeEventListener('pagehide', leave); };
  }, []);

  useEffect(() => { restoreScroll(target.current); }, [r]);
  return r;
}
