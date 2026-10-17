// Page titles, descriptions, share images and structured data. Plain JavaScript on purpose:
// it runs in the browser (for tabs and Google's renderer) and on the server (api/page.js), so link previews
// from WhatsApp, Facebook and others, which do not run scripts, show the right product.

export const PRIVATE_PAGES = ['cart', 'checkout', 'account', 'login', 'register', 'forgot', 'reset', 'order', 'invoice', 'admin', 'labels'];
const KNOWN = ['', 'shop', 'product', 'gifts', 'gift-cards', 'finder', 'about', 'contact', 'faq', 'shipping', 'care', 'privacy', 'terms', 'track', ...PRIVATE_PAGES];

const STATIC_META = {
  '': ['{shop} · Hand-poured soy wax candles in Sri Lanka', 'Hand-poured, non-toxic soy wax candles in mould, glass and jar. Choose your colour or blend your own, add a sticker message, or create a gift box. Delivered across Sri Lanka.'],
  shop: ['Shop candles | {shop}', 'Browse hand-poured soy wax candles in mould, glass and jar, in fifteen colours or your own blend.'],
  gifts: ['Create your own gift box | {shop}', 'Pick the candles, choose every colour, add a personal note and we wrap it all up beautifully.'],
  'gift-cards': ['Gift cards | {shop}', 'Give the gift of candlelight. A {shop} gift card is delivered as a code the recipient can use at checkout.'],
  finder: ['Find your colour | {shop}', 'Answer two quick questions and we will suggest a candle and a colour.'],
  about: ['About us | {shop}', 'Ember & Eve makes hand-poured soy wax candles in Sri Lanka, in small batches and with proper care for every single one.'],
  contact: ['Contact | {shop}', 'Questions about a candle or an order? Message us on WhatsApp or send an email.'],
  faq: ['Frequently asked questions | {shop}', 'Burn times, colours, gifts, payment and delivery: answers to the questions we hear most.'],
  shipping: ['Shipping and returns | {shop}', 'Delivery rates and times across Sri Lanka, store pickup, and what we do if something goes wrong.'],
  care: ['Candle care | {shop}', 'How to burn your candle safely for an even melt and a longer life.'],
  privacy: ['Privacy policy | {shop}', 'What we collect, how we use it and your rights.'],
  terms: ['Terms of sale | {shop}', 'Orders, pricing and made-to-order terms.'],
  track: ['Track your order | {shop}', 'Follow your order with your mobile number and order number or courier tracking number.'],
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n = 200) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const rs = (n) => 'Rs ' + Math.round(n).toLocaleString('en-LK');

/** Price of the default selection (first choice of every option group), after any sale. */
export function startingPrice(p) {
  const list = Number(p.base || 0) + (p.groups || []).reduce((a, g) => a + Number((g.options && g.options[0] && g.options[0].add) || 0), 0);
  return Math.round(list * (1 - Number(p.salePct || 0) / 100));
}
const inStock = (p) => p.stock === null || p.stock === undefined || p.stock > 0;

/**
 * @param {{ path: string, query?: Record<string,string>, origin: string, data?: { products?: any[], categories?: any[], seasons?: any[], settings?: any } | null }} a
 */
export function metaFor({ path, query = {}, origin, data }) {
  const parts = String(path || '/').replace(/^\/+|\/+$/g, '').split('/');
  const name = parts[0] || '';
  const arg = parts[1] || '';
  const st = (data && data.settings) || {};
  const shop = st.shop || 'Ember & Eve';
  const fill = (s) => s.replace(/\{shop\}/g, shop);
  const meta = { status: 200, title: '', description: '', canonical: origin + (name ? '/' + name + (arg ? '/' + arg : '') : '/'), robots: 'index, follow', image: origin + '/og.png', type: 'website', jsonld: [], shop, lang: 'en' };

  if (!KNOWN.includes(name)) { meta.status = 404; meta.robots = 'noindex'; meta.title = 'Page not found | ' + shop; meta.description = 'This page does not exist.'; return meta; }
  if (PRIVATE_PAGES.includes(name)) { meta.robots = 'noindex, nofollow'; meta.title = (name === 'admin' ? 'Admin' : name.charAt(0).toUpperCase() + name.slice(1)) + ' | ' + shop; meta.description = shop; return meta; }

  if (name === 'product') {
    const p = data && (data.products || []).find((x) => String(x.id) === arg && x.active !== false);
    if (!p) { if (data) { meta.status = 404; meta.robots = 'noindex'; } meta.title = 'Candle | ' + shop; meta.description = fill(STATIC_META[''][1]); return meta; }
    const img = (p.images && p.images[0]) || meta.image;
    const cat = ((data.categories || []).find((c) => c.id === p.cat) || {}).name;
    meta.title = p.name + (cat ? ' · ' + cat : '') + ' | ' + shop;
    meta.description = clip((p.blurb || '') + ' Hand-poured soy wax, from ' + rs(startingPrice(p)) + '. Choose your colour' + (p.groups && p.groups.length ? ' and options' : '') + '.', 200);
    meta.image = /^(https?:|data:)/.test(img) ? img : origin + img;
    meta.type = 'product';
    meta.jsonld.push({
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: clip(p.desc || p.blurb, 400), sku: String(p.id),
      image: (p.images && p.images.length ? p.images : [meta.image]).map((u) => (/^(https?:|data:)/.test(u) ? u : origin + u)),
      brand: { '@type': 'Brand', name: shop }, category: cat,
      offers: { '@type': 'Offer', url: meta.canonical, priceCurrency: 'LKR', price: String(startingPrice(p)), availability: inStock(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition' },
    });
    return meta;
  }

  if (name === 'shop') {
    meta.title = fill(STATIC_META.shop[0]); meta.description = fill(STATIC_META.shop[1]);
    const cat = query.cat && data && (data.categories || []).find((c) => c.id === query.cat);
    if (cat) { meta.title = cat.name + ' | ' + shop; meta.description = clip(cat.blurb || meta.description); meta.canonical = origin + '/shop?cat=' + cat.id; if (cat.image) meta.image = /^(https?:|data:)/.test(cat.image) ? cat.image : origin + cat.image; }
    else if (query.seasonal === '1') { meta.title = 'Seasonal candles | ' + shop; meta.canonical = origin + '/shop?seasonal=1'; }
    else if (query.season) { const s = data && (data.seasons || []).find((x) => x.id === query.season); if (s) { meta.title = s.name + ' | ' + shop; meta.description = clip(s.blurb || meta.description); meta.canonical = origin + '/shop?season=' + s.id; } }
    else if (query.shelf) { meta.canonical = origin + '/shop?shelf=' + encodeURIComponent(query.shelf); }
    else if (query.q) { meta.robots = 'noindex, follow'; meta.title = 'Search | ' + shop; }
    return meta;
  }

  const row = STATIC_META[name] || STATIC_META[''];
  meta.title = fill(row[0]); meta.description = fill(row[1]);
  if (name === '') {
    const sameAs = ['instagram', 'facebook', 'tiktok', 'youtube'].map((k) => st[k]).filter(Boolean);
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'Organization', name: shop, url: origin, logo: origin + '/logo.png', ...(sameAs.length ? { sameAs } : {}), ...(st.email ? { email: st.email } : {}), areaServed: 'LK' });
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: shop, url: origin, potentialAction: { '@type': 'SearchAction', target: origin + '/shop?q={search_term_string}', 'query-input': 'required name=search_term_string' } });
  }
  return meta;
}

/** The <head> tags for a page. */
export function renderTags(m) {
  const t = [
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.canonical)}" />`,
    `<meta name="robots" content="${esc(m.robots)}" />`,
    `<meta property="og:site_name" content="${esc(m.shop)}" />`,
    `<meta property="og:type" content="${esc(m.type)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.canonical)}" />`,
    `<meta property="og:image" content="${esc(m.image)}" />`,
    `<meta property="og:locale" content="en_LK" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.image)}" />`,
  ];
  m.jsonld.forEach((j) => t.push(`<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`));
  return t.join('\n    ');
}

/** Put a page's title and tags into the built index.html. */
export function injectHead(html, m) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(m.title)}</title>`);
  out = out.replace(/<meta\s+name="description"[^>]*>\s*/i, '');
  out = out.replace(/<meta\s+(?:name|property)="(?:og|twitter):[^"]*"[^>]*>\s*/gi, '');
  out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/i, '');
  return out.replace('</head>', '    ' + renderTags(m) + '\n  </head>');
}

/** sitemap.xml body */
export function sitemapXml(origin, data) {
  const urls = ['/', '/shop', '/gifts', '/gift-cards', '/finder', '/about', '/contact', '/faq', '/shipping', '/care', '/track', '/privacy', '/terms'];
  const d = data || {};
  (d.categories || []).forEach((c) => urls.push('/shop?cat=' + c.id));
  (d.products || []).filter((p) => p.active !== false).forEach((p) => urls.push('/product/' + p.id));
  const body = urls.map((u) => `  <url><loc>${esc(origin + u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nDisallow: /order/\nDisallow: /invoice/\nSitemap: ${origin}/sitemap.xml\n`;
}
