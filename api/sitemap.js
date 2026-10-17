import { sitemapXml } from '../src/seo-core.js';
import { loadData, originOf } from './_data.js';

export default async function handler(req, res) {
  const origin = originOf(req);
  const data = await loadData();
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(sitemapXml(origin, data));
}
