import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ProductCard } from '../components/ProductCard';
import { Chip } from '../components/ui';
import { FAMILIES, money, scentOf } from '../store';
import { go, type Route } from '../router';

type Sort = 'feat' | 'lo' | 'hi' | 'az';

export function Shop({ route }: { route: Route }) {
  const { active } = useApp();
  const [shape, setShape] = useState(0);
  const [fam, setFam] = useState('All');
  const [sort, setSort] = useState<Sort>('feat');
  const [max, setMax] = useState(40);
  const [stockOnly, setStockOnly] = useState(false);
  const q = (route.q.q || '').toLowerCase();

  const list = useMemo(() => {
    let l = active.slice();
    if (shape) l = l.filter((p) => p.id === shape);
    if (fam !== 'All') l = l.filter((p) => p.scents.some((n) => scentOf(n).f === fam));
    if (q) l = l.filter((p) => (p.name + ' ' + p.blurb + ' ' + p.scents.join(' ')).toLowerCase().includes(q));
    l = l.filter((p) => p.sizes[0].p <= max);
    if (stockOnly) l = l.filter((p) => p.sizes.some((z) => z.stock > 0));
    if (sort === 'lo') l.sort((a, b) => a.sizes[0].p - b.sizes[0].p);
    if (sort === 'hi') l.sort((a, b) => b.sizes[0].p - a.sizes[0].p);
    if (sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [active, shape, fam, q, max, stockOnly, sort]);

  const clear = () => { setShape(0); setFam('All'); setMax(40); setStockOnly(false); go('shop'); };

  return (
    <section className="page">
      <div className="crumb">Home / Shop</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', margin: '8px 0 24px' }}>
        <div>
          <h1 className="h1">Shop</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{list.length} {list.length === 1 ? 'candle' : 'candles'}</p>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" style={{ font: '500 14px Inter', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--sand)', background: '#fff', color: 'var(--ink)' }}>
          <option value="feat">Sort: Featured</option>
          <option value="lo">Price: Low to High</option>
          <option value="hi">Price: High to Low</option>
          <option value="az">Name: A to Z</option>
        </select>
      </div>

      <div className="layout-shop">
        <aside className="card stack" style={{ gap: 16 }}>
          {route.q.q && <div style={{ fontSize: 14 }}>Search: <b>{route.q.q}</b> <a href="#/shop" style={{ marginLeft: 8, fontSize: 12 }}>Clear</a></div>}
          <div>
            <div className="label-s">Shape</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip on={shape === 0} onClick={() => setShape(0)}>All</Chip>
              {active.map((p) => <Chip key={p.id} on={shape === p.id} onClick={() => setShape(p.id)}>{p.shape}</Chip>)}
            </div>
          </div>
          <div>
            <div className="label-s">Scent family</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FAMILIES.map((c) => <Chip key={c} on={fam === c} onClick={() => setFam(c)}>{c}</Chip>)}
            </div>
          </div>
          <div>
            <div className="label-s">Up to {money(max)}</div>
            <input type="range" min={10} max={40} step={1} value={max} onChange={(e) => setMax(Number(e.target.value))} aria-label="Maximum price" style={{ width: '100%', accentColor: '#8F6642' }} />
          </div>
          <button type="button" className="chip lg soft" onClick={() => setStockOnly(!stockOnly)} aria-pressed={stockOnly} style={{ textAlign: 'left', borderColor: stockOnly ? 'var(--brown)' : undefined, background: stockOnly ? 'var(--cream)' : '#fff' }}>
            {stockOnly ? 'In stock only: on' : 'In stock only: off'}
          </button>
        </aside>

        <div style={{ minWidth: 0 }}>
          {list.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500 }}>No candles match.</div>
              <p className="muted">Try removing a filter.</p>
              <button type="button" className="btn ghost" onClick={clear}>Clear Filters</button>
            </div>
          )}
          <div className="pgrid">{list.map((p) => <ProductCard key={p.id} p={p} fam={fam} />)}</div>
        </div>
      </div>
    </section>
  );
}
