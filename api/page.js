// Serves the app shell for every page, with that page's own title, description, share image and structured data
// in the HTML. Browsers then run the app as usual; link previews (WhatsApp, Facebook) and search engines read the tags.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { injectHead, metaFor } from '../src/seo-core.js';
import { loadData, originOf } from './_data.js';

async function shell(origin) {
  try { return await readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8'); } catch { /* fall through to the static copy */ }
  const r = await fetch(origin + '/index.html');
  if (!r.ok) throw new Error('index.html not available');
  return await r.text();
}

export default async function handler(req, res) {
  const origin = originOf(req);
  let html;
  try { html = await shell(origin); } catch { res.status(503).send('Temporarily unavailable. Please try again in a moment.'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const { p = '', ...query } = req.query || {};
    const data = await loadData();
    const meta = metaFor({ path: '/' + String(p), query: Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])), origin, data });
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
    res.status(meta.status).send(injectHead(html, meta));
  } catch {
    res.status(200).send(html); // never break the site over a preview
  }
}
