// Page titles, descriptions, share images and structured data. Plain JavaScript on purpose:
// it runs in the browser (for tabs and Google's renderer) and on the server (api/page.js), so link previews
// from WhatsApp, Facebook and others, which do not run scripts, show the right product.
import { FAQS } from './faq-data.js';
import { GUIDES, guideBySlug } from './guides-data.js';

export const PRIVATE_PAGES = ['cart', 'checkout', 'account', 'login', 'register', 'forgot', 'reset', 'order', 'invoice', 'admin', 'labels'];
const KNOWN = ['', 'shop', 'guides', 'product', 'gifts', 'gift-cards', 'finder', 'about', 'contact', 'faq', 'shipping', 'care', 'privacy', 'terms', 'track', ...PRIVATE_PAGES];

const STATIC_META = {
  '': ['{shop} | Handmade Soy Wax Candles in Sri Lanka', 'Shop handmade soy wax candles in Sri Lanka. Hand-poured, non-toxic soy candles in mould, glass and jar, in any colour or your own blend. Gift boxes and island-wide delivery from Ember & Eve.'],
  shop: ['Shop Soy Candles in Sri Lanka | {shop}', 'Browse handmade soy wax candles in Sri Lanka: mould, glass and jar candles in fifteen colours or your own blend. Hand-poured, non-toxic, delivered island-wide.'],
  guides: ['Candle Guides | {shop}', 'Guides to soy wax candles in Sri Lanka: choosing a candle, gift ideas, soy vs paraffin wax and candle care, from the makers at {shop}.'],
  gifts: ['Candle Gift Boxes in Sri Lanka | {shop}', 'Create your own candle gift box in Sri Lanka. Pick handmade soy wax candles, choose every colour, add a personal note and we wrap it all up beautifully.'],
  'gift-cards': ['Gift cards | {shop}', 'Give the gift of candlelight. A {shop} gift card is delivered as a code the recipient can use at checkout.'],
  finder: ['Find your colour | {shop}', 'Answer two quick questions and we will suggest a candle and a colour.'],
  about: ['About Us: Sri Lankan Soy Candle Makers | {shop}', 'Ember & Eve is a Sri Lankan candle brand making hand-poured soy wax candles in small batches, with proper care for every single one.'],
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
/** A trail of links Google can show under the page title: Home > Shop > Jar Candles > Hexagon Jar. */
function breadcrumbs(origin, trail) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: origin + path })),
  };
}
const approvedFor = (data, pid) => ((data && data.reviews) || []).filter((r) => String(r.pid) === String(pid) && Number(r.stars) >= 1 && Number(r.stars) <= 5);
const inStock = (p) => p.stock === null || p.stock === undefined || p.stock > 0;

const money0 = (n) => 'Rs ' + Math.round(n).toLocaleString('en-LK');
const abs = (origin, u) => (/^(https?:|data:)/.test(u) ? u : origin + u);
/** Plain, crawlable HTML for a page: shown to search engines and link scrapers until the app takes over. */
const NAV_LINKS = [['Shop soy candles', '/shop'], ['Gift boxes', '/gifts'], ['Candle guides', '/guides'], ['About', '/about'], ['FAQ', '/faq'], ['Shipping and returns', '/shipping'], ['Contact', '/contact']];
const ul = (items) => '<ul>' + items.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('') + '</ul>';
const page = (h1, paras, extra = '') => `<main><h1>${esc(h1)}</h1>${(paras || []).filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('')}${extra}</main><nav aria-label="Main">${ul(NAV_LINKS)}</nav>`;
const productLinks = (data, cat) => {
  const list = ((data && data.products) || []).filter((p) => p.active !== false && (!cat || p.cat === cat)).slice(0, 80);
  return list.length ? '<ul>' + list.map((p) => `<li><a href="/product/${esc(p.id)}">${esc(p.name)}</a> from ${esc(money0(startingPrice(p)))}</li>`).join('') + '</ul>' : '';
};
const faqBlock = (faqs) => (faqs.length ? '<section><h2>Frequently asked questions</h2>' + faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') + '</section>' : '');
const faqLd = (faqs) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });

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
  const meta = { status: 200, title: '', description: '', canonical: origin + (name ? '/' + name + (arg ? '/' + arg : '') : '/'), robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1', body: '', image: origin + '/og.png', type: 'website', jsonld: [], shop, lang: 'en' };

  if (!KNOWN.includes(name)) { meta.status = 404; meta.robots = 'noindex'; meta.title = 'Page not found | ' + shop; meta.description = 'This page does not exist.'; return meta; }
  if (PRIVATE_PAGES.includes(name)) { meta.robots = 'noindex, nofollow'; meta.title = (name === 'admin' ? 'Admin' : name.charAt(0).toUpperCase() + name.slice(1)) + ' | ' + shop; meta.description = shop; return meta; }

  if (name === 'guides') {
    meta.canonical = origin + '/guides' + (arg ? '/' + arg : '');
    if (!arg) {
      meta.title = fill(STATIC_META.guides[0]); meta.description = fill(STATIC_META.guides[1]);
      meta.body = page('Candle guides', [meta.description], ul(GUIDES.map((g) => [g.title, '/guides/' + g.slug])));
      meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['Guides', '/guides']]));
      return meta;
    }
    const g = guideBySlug(arg);
    if (!g) { meta.status = 404; meta.robots = 'noindex'; meta.title = 'Page not found | ' + shop; meta.description = 'This page does not exist.'; return meta; }
    meta.title = g.metaTitle + ' | ' + shop; meta.description = g.description; meta.type = 'article';
    meta.body = page(g.title, [g.intro], g.sections.map((x) => `<section><h2>${esc(x.h)}</h2>${x.p.map((t) => `<p>${esc(t)}</p>`).join('')}</section>`).join('') + ul(g.links) + faqBlock(g.faq));
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, image: meta.image, mainEntityOfPage: meta.canonical, inLanguage: 'en', author: { '@type': 'Organization', name: shop, url: origin }, publisher: { '@type': 'Organization', name: shop, logo: { '@type': 'ImageObject', url: origin + '/logo.png' } } });
    if (g.faq && g.faq.length) meta.jsonld.push(faqLd(g.faq));
    meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['Guides', '/guides'], [g.title, '/guides/' + g.slug]]));
    return meta;
  }

  if (name === 'product') {
    const p = data && (data.products || []).find((x) => String(x.id) === arg && x.active !== false);
    if (!p) { if (data) { meta.status = 404; meta.robots = 'noindex'; } meta.title = 'Candle | ' + shop; meta.description = fill(STATIC_META[''][1]); return meta; }
    const img = (p.images && p.images[0]) || meta.image;
    const cat = ((data.categories || []).find((c) => c.id === p.cat) || {}).name;
    meta.title = p.name + (cat ? ' · ' + cat : '') + ' | Soy Candle Sri Lanka | ' + shop;
    meta.description = clip((p.blurb || '') + ' Hand-poured soy wax, from ' + rs(startingPrice(p)) + '. Choose your colour' + (p.groups && p.groups.length ? ' and options' : '') + '.', 200);
    meta.image = /^(https?:|data:)/.test(img) ? img : origin + img;
    meta.type = 'product';
    const price = startingPrice(p);
    const st2 = st || {};
    const freeOver = Number(st2.freeOver || 0), stdRate = Number(st2.standard || 0);
    const offer = {
      '@type': 'Offer', url: meta.canonical, priceCurrency: 'LKR', price: String(price),
      availability: inStock(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: shop },
      // handling is the pouring time; delivery is the courier time (see the Shipping and Returns page)
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: String(freeOver && price >= freeOver ? 0 : stdRate), currency: 'LKR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'LK' },
        deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 5, unitCode: 'DAY' } },
      },
      // made to order: no change-of-mind returns; damaged items are replaced or refunded (see the page linked below)
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'LK', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted', merchantReturnLink: origin + '/shipping' },
    };
    const product = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: clip(p.desc || p.blurb, 400), sku: String(p.id),
      image: (p.images && p.images.length ? p.images : [meta.image]).map((u) => (/^(https?:|data:)/.test(u) ? u : origin + u)),
      brand: { '@type': 'Brand', name: shop }, category: cat, offers: offer,
    };
    const rv = approvedFor(data, p.id);
    if (rv.length) {
      product.aggregateRating = { '@type': 'AggregateRating', ratingValue: (rv.reduce((a, r) => a + Number(r.stars), 0) / rv.length).toFixed(1), reviewCount: String(rv.length), bestRating: '5', worstRating: '1' };
      product.review = rv.slice(0, 5).map((r) => ({
        '@type': 'Review', author: { '@type': 'Person', name: String(r.who || 'Customer').split(',')[0] }, datePublished: r.date,
        reviewRating: { '@type': 'Rating', ratingValue: String(r.stars), bestRating: '5', worstRating: '1' }, reviewBody: clip(r.q, 300),
      }));
    }
    meta.jsonld.push(product);
    meta.body = page(p.name, [p.desc || p.blurb, 'Hand-poured soy wax candle made in Sri Lanka. From ' + money0(price) + '. ' + (inStock(p) ? 'In stock.' : 'Currently sold out.')], (cat ? `<p>Category: <a href="/shop?cat=${esc(p.cat)}">${esc(cat)}</a></p>` : '') + (p.groups || []).map((gr) => (gr.options && gr.options.length ? `<h2>${esc(gr.name || gr.label || 'Options')}</h2><ul>${gr.options.map((o) => `<li>${esc(o.label)}</li>`).join('')}</ul>` : '')).join(''));
    meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['Shop', '/shop'], ...(cat ? [[cat, '/shop?cat=' + p.cat]] : []), [p.name, '/product/' + p.id]]));
    return meta;
  }

  if (name === 'shop') {
    meta.title = fill(STATIC_META.shop[0]); meta.description = fill(STATIC_META.shop[1]);
    const cat = query.cat && data && (data.categories || []).find((c) => c.id === query.cat);
    if (cat) { meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['Shop', '/shop'], [cat.name, '/shop?cat=' + cat.id]])); meta.title = cat.name + ' · Soy Wax Candles in Sri Lanka | ' + shop; meta.description = clip((cat.blurb ? cat.blurb + ' ' : '') + 'Handmade soy wax candles in Sri Lanka, hand-poured by ' + shop + '.', 200); meta.canonical = origin + '/shop?cat=' + cat.id; if (cat.image) meta.image = /^(https?:|data:)/.test(cat.image) ? cat.image : origin + cat.image; }
    else if (query.seasonal === '1') { meta.title = 'Seasonal Candles Sri Lanka | ' + shop; meta.canonical = origin + '/shop?seasonal=1'; }
    else if (query.season) { const s = data && (data.seasons || []).find((x) => x.id === query.season); if (s) { meta.title = s.name + ' | ' + shop; meta.description = clip(s.blurb || meta.description); meta.canonical = origin + '/shop?season=' + s.id; } }
    else if (query.shelf) { meta.canonical = origin + '/shop?shelf=' + encodeURIComponent(query.shelf); }
    else if (query.q) { meta.robots = 'noindex, follow'; meta.title = 'Search | ' + shop; }
    {
      const items = ((data && data.products) || []).filter((p) => p.active !== false && (!query.cat || p.cat === query.cat)).slice(0, 60);
      meta.body = page(cat ? cat.name + ' · soy wax candles in Sri Lanka' : 'Soy candles in Sri Lanka', [meta.description], productLinks(data, query.cat));
      if (items.length && !query.q) meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'ItemList', name: cat ? cat.name : 'Soy wax candles', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: origin + '/product/' + p.id, name: p.name })) });
    }
    return meta;
  }

  const row = STATIC_META[name] || STATIC_META[''];
  meta.title = fill(row[0]); meta.description = fill(row[1]);
  meta.body = page(name === '' ? 'Handmade soy wax candles in Sri Lanka' : row[0].split('|')[0].trim(), [meta.description], name === '' ? '<h2>Shop</h2>' + ul(((data && data.categories) || []).map((c) => [c.name, '/shop?cat=' + c.id])) + productLinks(data) + '<h2>Guides</h2>' + ul(GUIDES.map((g) => [g.title, '/guides/' + g.slug])) : name === 'faq' ? faqBlock(FAQS) : '');
  if (name === 'faq') {
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
    meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['FAQ', '/faq']]));
  }
  if (name === 'shipping') meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['Shipping and returns', '/shipping']]));
  if (name === 'shop' && !query.cat && !query.q && !query.shelf && !query.season && query.seasonal !== '1') meta.jsonld.push(breadcrumbs(origin, [['Home', '/'], ['Shop', '/shop']]));
  if (name === '') {
    const sameAs = ['instagram', 'facebook', 'tiktok', 'youtube'].map((k) => st[k]).filter(Boolean);
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'Organization', name: shop, alternateName: ['Ember and Eve', 'Ember Eve', 'Eve Ember', 'Ember & Eve Sri Lanka'], url: origin, logo: origin + '/logo.png', ...(sameAs.length ? { sameAs } : {}), ...(st.email ? { email: st.email } : {}), areaServed: 'LK', description: 'Ember & Eve makes handmade soy wax candles in Sri Lanka: hand-poured, non-toxic soy candles in mould, glass and jar, with gift boxes and island-wide delivery.', foundingLocation: { '@type': 'Country', name: 'Sri Lanka' }, address: { '@type': 'PostalAddress', addressCountry: 'LK' } });
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'Store', name: shop, url: origin, image: origin + '/og.png', logo: origin + '/logo.png', description: 'Handmade soy wax candles in Sri Lanka, hand-poured to order with island-wide delivery.', areaServed: { '@type': 'Country', name: 'Sri Lanka' }, address: { '@type': 'PostalAddress', addressCountry: 'LK' }, priceRange: 'Rs', currenciesAccepted: 'LKR', paymentAccepted: 'Bank transfer, LankaQR', ...(sameAs.length ? { sameAs } : {}), ...(st.whatsapp ? { telephone: '+' + String(st.whatsapp).replace(/\D/g, '') } : {}) });
    meta.jsonld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: shop, alternateName: ['Ember and Eve', 'Ember Eve', 'Eve Ember'], url: origin, potentialAction: { '@type': 'SearchAction', target: origin + '/shop?q={search_term_string}', 'query-input': 'required name=search_term_string' } });
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
  out = out.replace('</head>', '    ' + renderTags(m) + '\n  </head>');
  // readable page content for crawlers and link scrapers; the app replaces it as soon as it starts
  if (m.body) out = out.replace('<div id="root"></div>', '<div id="root"><div class="seo-fallback" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">' + m.body + '</div></div>');
  return out;
}

/** sitemap.xml body */
export function sitemapXml(origin, data) {
  const urls = ['/', '/shop', '/gifts', '/gift-cards', '/finder', '/guides', ...GUIDES.map((g) => '/guides/' + g.slug), '/about', '/contact', '/faq', '/shipping', '/care', '/track', '/privacy', '/terms'];
  const d = data || {};
  (d.categories || []).forEach((c) => urls.push('/shop?cat=' + c.id));
  (d.products || []).filter((p) => p.active !== false).forEach((p) => urls.push('/product/' + p.id));
  const imgs = {};
  (d.products || []).filter((p) => p.active !== false).forEach((p) => { if (p.images && p.images.length) imgs['/product/' + p.id] = p.images.slice(0, 5).map((u) => ({ u: abs(origin, u), t: p.name })); });
  const body = urls.map((u) => `  <url><loc>${esc(origin + u)}</loc>${(imgs[u] || []).map((i) => `<image:image><image:loc>${esc(i.u)}</image:loc><image:title>${esc(i.t)}</image:title></image:image>`).join('')}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
}

export function robotsTxt(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nDisallow: /order/\nDisallow: /invoice/\nDisallow: /login\nDisallow: /register\nDisallow: /forgot\nDisallow: /reset\nDisallow: /labels\nDisallow: /*?q=\nDisallow: /*?ref=\nSitemap: ${origin}/sitemap.xml\n`;
}
