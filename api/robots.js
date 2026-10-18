import { robotsTxt } from '../src/seo-core.js';
import { originOf } from './_data.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(robotsTxt(originOf(req)));
}
