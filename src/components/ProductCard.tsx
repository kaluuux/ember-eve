import { useState } from 'react';
import type { Product } from '../types';
import { useApp } from '../AppContext';
import { go } from '../router';
import { Chip } from './ui';
import { money, scentOf } from '../store';
import { firstInStock, inStock, lowestPrice, ratingOf } from '../commerce';

export function ProductCard({ p, fam = 'All' }: { p: Product; fam?: string }) {
  const { reviews, wish, toggleWish, setQv } = useApp();
  const [picked, setPicked] = useState('');
  const matching = p.scents.filter((n) => fam === 'All' || scentOf(n).f === fam);
  const list = matching.length ? matching : p.scents;
  const cur = list.includes(picked) ? picked : list[0];
  const rt = ratingOf(reviews, p.id);
  const sold = !inStock(p);
  const saved = wish.includes(p.id);
  const href = '#/product/' + p.id;

  return (
    <article className="pcard">
      <a href={href} className="ph stripe thumb" style={{ background: scentOf(cur).tint }}>
        <span>Image: {p.name}, {cur}</span>
        {sold && <span className="badge">Sold out</span>}
      </a>
      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <a href={href} className="name">{p.name}</a>
        <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--muted)' }}>{p.blurb}</div>
        <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{rt.n ? rt.avg.toFixed(1) + ' / 5 (' + rt.n + ')' : 'No reviews yet'}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
        {list.map((n) => <Chip key={n} on={n === cur} onClick={() => setPicked(n)}>{n}</Chip>)}
      </div>
      <div className="foot">
        <div style={{ fontSize: 16, fontWeight: 600 }}>From {money(lowestPrice(p))}</div>
        <div className="acts">
          <button type="button" onClick={() => toggleWish(p.id)} aria-pressed={saved} className="btn-xs" style={{ padding: '10px 12px', borderColor: saved ? 'var(--brown)' : undefined, background: saved ? 'var(--cream)' : undefined }}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontWeight: 500, fontSize: 14, padding: '10px 12px' }}
            onClick={() => (sold ? go('product/' + p.id) : setQv({ id: p.id, scent: cur, si: firstInStock(p), wi: 0, qty: 1 }))}
          >
            {sold ? 'View' : 'Quick add'}
          </button>
        </div>
      </div>
    </article>
  );
}
