import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ProductCard } from '../components/ProductCard';
import { Chip } from '../components/ui';
import { money } from '../store';
import { go, type Route } from '../router';
import { SHELVES, inStock, lowestPrice, type Shelf } from '../commerce';
import { useHydrated } from '../sync';
import { useT } from '../i18n';

type Sort = 'feat' | 'lo' | 'hi' | 'az';

/** Filters come from the URL (?cat=, ?shelf=, ?season=, ?q=) so home links and the menu can deep-link here. */
export function Shop({ route }: { route: Route }) {
  const t = useT();
  const { products, seasonal: seasonalAll, seasons, categories, liveSeasons, shelf } = useApp();
  const hydrated = useHydrated();
  const cat = route.q.cat || '';
  const shelfId = (route.q.shelf || '') as Shelf | '';
  const season = route.q.season || '';
  /** Seasonal browse: every seasonal candle, even for seasons that are closed right now */
  const seasonalMode = route.q.seasonal === '1';
  const q = (route.q.q || '').toLowerCase();
  const [sort, setSort] = useState<Sort>('feat');
  const [capPct, setCapPct] = useState(100);
  const [stockOnly, setStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /** The shop lists every switched-on candle, whether or not its season is open; the Season filter narrows it down. */
  const everything = useMemo(() => products.filter((p) => p.active), [products]);
  const top = useMemo(() => Math.max(100, ...everything.map((p) => lowestPrice(p))), [everything]);
  const step = top > 5000 ? 100 : 50;
  const max = Math.round((top * capPct) / 100 / step) * step || top;
  /** Seasons that have at least one candle, and whether any candle is year-round */
  const seasonChips = useMemo(() => seasons.filter((s) => everything.some((p) => p.season === s.id)), [seasons, everything]);
  const hasYearRound = useMemo(() => everything.some((p) => !p.season), [everything]);

  const list = useMemo(() => {
    let l = seasonalMode ? seasonalAll.slice() : shelfId ? shelf(shelfId) : everything.slice();
    if (cat) l = l.filter((p) => p.cat === cat);
    if (season === 'none') l = l.filter((p) => !p.season);
    else if (season) l = l.filter((p) => p.season === season);
    if (q) l = l.filter((p) => (p.name + ' ' + p.blurb + ' ' + p.groups.map((g) => g.options.map((o) => o.label).join(' ')).join(' ')).toLowerCase().includes(q));
    if (capPct < 100) l = l.filter((p) => lowestPrice(p) <= max);
    if (stockOnly) l = l.filter(inStock);
    if (sort === 'lo') l.sort((a, b) => lowestPrice(a) - lowestPrice(b));
    if (sort === 'hi') l.sort((a, b) => lowestPrice(b) - lowestPrice(a));
    if (sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [everything, seasonalAll, seasonalMode, shelf, shelfId, cat, season, q, capPct, max, stockOnly, sort]);

  const link = (o: { cat?: string; shelf?: string; season?: string }) => {
    const n = { cat, shelf: shelfId, season, seasonal: seasonalMode ? '1' : '', ...o };
    const qs = new URLSearchParams();
    Object.entries(n).forEach(([k, v]) => { if (v) qs.set(k, v); });
    if (route.q.q) qs.set('q', route.q.q);
    go('shop' + (qs.toString() ? '?' + qs.toString() : ''));
  };
  const clear = () => { setCapPct(100); setStockOnly(false); go('shop'); };
  const seasonName = season === 'none' ? t('Year-round') : seasons.find((s) => s.id === season)?.name;
  const title = seasonalMode ? (season ? seasonName : t('Seasonal Candles')) : shelfId ? t(SHELVES.find((s) => s.id === shelfId)?.title ?? '') : season ? seasonName : categories.find((c) => c.id === cat)?.name;

  return (
    <section className="page">
      <div className="crumb">{t('Home / Shop')}{title ? ' / ' + title : ''}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', margin: '8px 0 24px' }}>
        <div>
          <h1 className="h1">{title || t('Shop')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{list.length} {list.length === 1 ? t('candle') : t('candles')}</p>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('Sort')} style={{ font: '500 14px Inter', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--sand)', background: '#fff', color: 'var(--ink)' }}>
          <option value="feat">{t('Sort: Featured')}</option>
          <option value="lo">{t('Price: Low to High')}</option>
          <option value="hi">{t('Price: High to Low')}</option>
          <option value="az">{t('Name: A to Z')}</option>
        </select>
      </div>

      <button type="button" className="filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
        {t('Filters')}{(cat || shelfId || season || capPct < 100 || stockOnly) ? ' ·' : ''} <span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
      </button>
      <div className="layout-shop">
        <aside className={'card stack filters-panel' + (filtersOpen ? ' open' : '')} style={{ gap: 16 }}>
          {route.q.q && <div style={{ fontSize: 14 }}>{t('Search:')}{' '}<b>{route.q.q}</b> <a href="/shop" style={{ marginLeft: 8, fontSize: 12 }}>{t('Clear')}</a></div>}
          <div>
            <div className="label-s">{t('Type')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip on={!cat} onClick={() => link({ cat: '' })}>{t('All')}</Chip>
              {categories.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => link({ cat: c.id })}>{c.name}</Chip>)}
            </div>
          </div>
          {!seasonalMode && (
            <div>
              <div className="label-s">{t('Collections')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip on={!shelfId} onClick={() => link({ shelf: '' })}>{t('All')}</Chip>
                {SHELVES.filter((s) => shelf(s.id).length > 0).map((s) => <Chip key={s.id} on={shelfId === s.id} onClick={() => link({ shelf: s.id })}>{t(s.title)}</Chip>)}
              </div>
            </div>
          )}
          {seasonChips.length > 0 && (
            <div>
              <div className="label-s">{t('Season')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip on={!season} onClick={() => link({ season: '' })}>{seasonalMode ? t('All seasons') : t('All')}</Chip>
                {seasonChips.map((s) => (
                  <Chip key={s.id} on={season === s.id} onClick={() => link({ season: s.id })}>{s.name.replace(' Collection', '')}{liveSeasons.some((l) => l.id === s.id) ? t(' · now') : ''}</Chip>
                ))}
                {!seasonalMode && hasYearRound && <Chip on={season === 'none'} onClick={() => link({ season: 'none' })}>{t('Year-round')}</Chip>}
              </div>
            </div>
          )}
          <div>
            <div className="label-s">{t('Up to')}{' '}{money(max)}</div>
            <input type="range" min={10} max={100} step={5} value={capPct} onChange={(e) => setCapPct(Number(e.target.value))} aria-label={t('Maximum price')} style={{ width: '100%', accentColor: '#8F6642' }} />
          </div>
          <button type="button" className="chip lg soft" onClick={() => setStockOnly(!stockOnly)} aria-pressed={stockOnly} style={{ textAlign: 'left', borderColor: stockOnly ? 'var(--brown)' : undefined, background: stockOnly ? 'var(--cream)' : '#fff' }}>
            {stockOnly ? t('In stock only: on') : t('In stock only: off')}
          </button>
        </aside>

        <div style={{ minWidth: 0 }}>
          {!q && !cat && !shelfId && !season && !seasonalMode && (
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14, lineHeight: '22px' }}>
              {t('Handmade soy wax candles in Sri Lanka, hand-poured to order in mould, glass and jar, with delivery across the island.')}{' '}<a href="/guides/soy-candles-sri-lanka">{t('Read our soy candle guide')}</a>
            </p>
          )}
          {list.length === 0 && !hydrated && <div className="pgrid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" />)}</div>}
          {list.length === 0 && hydrated && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{t('No candles match.')}</div>
              <p className="muted">{t('Try removing a filter.')}</p>
              <button type="button" className="btn ghost" onClick={clear}>{t('Clear Filters')}</button>
            </div>
          )}
          <div className="pgrid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </div>
      </div>
    </section>
  );
}
