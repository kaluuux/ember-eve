import { useEffect } from 'react';
import { useApp } from '../AppContext';
import { metaFor } from '../seo-core.js';
import type { Route } from '../router';

const setTag = (sel: string, make: () => HTMLElement, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLElement>(sel);
  if (!el) { el = make(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
};
const metaName = (name: string, value: string) => setTag(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', value);
const metaProp = (property: string, value: string) => setTag(`meta[property="${property}"]`, () => { const m = document.createElement('meta'); m.setAttribute('property', property); return m; }, 'content', value);

/** Keeps the tab title, description, canonical link and structured data in step with the page being viewed. */
export function Seo({ route }: { route: Route }) {
  const { products, categories, seasons, settings } = useApp();
  useEffect(() => {
    const m = metaFor({ path: '/' + [route.name === 'home' ? '' : route.name, route.arg].filter(Boolean).join('/'), query: route.q, origin: location.origin, data: { products, categories, seasons, settings } });
    document.title = m.title;
    metaName('description', m.description);
    metaName('robots', m.robots);
    setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', m.canonical);
    metaProp('og:title', m.title); metaProp('og:description', m.description); metaProp('og:image', m.image); metaProp('og:url', m.canonical); metaProp('og:type', m.type);
    document.head.querySelectorAll('script[data-ld]').forEach((n) => n.remove());
    m.jsonld.forEach((j) => { const s = document.createElement('script'); s.type = 'application/ld+json'; s.setAttribute('data-ld', ''); s.textContent = JSON.stringify(j); document.head.appendChild(s); });
  }, [route.name, route.arg, route.q, products, categories, seasons, settings]);
  return null;
}
