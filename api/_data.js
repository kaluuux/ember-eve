// Public catalogue data for titles, previews and the sitemap. Uses only the public (anon) key.
let cache = { at: 0, data: null };

export async function loadData() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (cache.data && Date.now() - cache.at < 60000) return cache.data;
  try {
    const r = await fetch(`${url}/rest/v1/catalog_kv?select=key,value&key=in.(products,categories,seasons,settings)`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) return cache.data;
    const rows = await r.json();
    const d = {};
    rows.forEach((x) => { d[x.key] = x.value; });
    // approved reviews (public by the database rules) feed the star ratings in search results
    try {
      const rv = await fetch(`${url}/rest/v1/reviews?select=data&approved=eq.true&order=id.desc&limit=500`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      d.reviews = rv.ok ? (await rv.json()).map((x) => x.data).filter(Boolean) : [];
    } catch { d.reviews = []; }
    cache = { at: Date.now(), data: d };
    return d;
  } catch {
    return cache.data;
  }
}

export function originOf(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}
