import { useState } from 'react';
import type { Product } from '../types';
import { useApp } from '../AppContext';
import { go } from '../router';
import { money } from '../store';
import { defaultSelection, fromListPrice, inStock, lowestPrice, normalize, ratingOf, soft } from '../commerce';
import { Ico } from './Flair';

const DOTS = 7;

export function ProductCard({ p }: { p: Product }) {
  const { reviews, wish, toggleWish, setQv, colors, categories } = useApp();
  const base = defaultSelection(p, colors);
  const [color, setColor] = useState('');
  const cur = p.colors && colors.some((c) => c.id === color) ? color : base.color;
  const hex = colors.find((c) => c.id === cur)?.hex ?? '#EADFD3';
  const rt = ratingOf(reviews, p.id);
  const sold = !inStock(p);
  const saved = wish.includes(p.id);
  const href = '#/product/' + p.id;
  const cat = categories.find((c) => c.id === p.cat)?.name;
  const isNew = Date.now() - new Date(p.created).getTime() <= 30 * 86400000;
  const from = lowestPrice(p), was = fromListPrice(p);

  return (
    <article className="pcard">
      <div className="thumb-wrap">
        <a href={href} className="ph stripe thumb" style={{ backgroundColor: soft(hex) }} aria-label={p.name}>
          <span className="badge-row">
            {p.salePct > 0 && <span className="tagpill sale">-{p.salePct}%</span>}
            {isNew && <span className="tagpill new">New</span>}
            {sold && <span className="badge">Sold out</span>}
          </span>
          <span>Image: {p.name}</span>
        </a>
        <button type="button" className="heart" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save ' + p.name} onClick={() => toggleWish(p.id)}><Ico n="heart" /></button>
      </div>
      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cat && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown)' }}>{cat}</div>}
        <a href={href} className="name">{p.name}</a>
        <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--muted)' }}>{p.blurb}</div>
        <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{rt.n ? rt.avg.toFixed(1) + ' / 5 (' + rt.n + ')' : 'No reviews yet'}</div>
      </div>
      {p.colors && (
        <div className="swatch-dots" aria-label="Colours">
          {colors.slice(0, DOTS).map((c) => (
            <button key={c.id} type="button" className={'swatch' + (c.id === cur ? ' on' : '')} style={{ background: c.hex }} aria-label={c.name} title={c.name} onClick={() => setColor(c.id)} />
          ))}
          {colors.length > DOTS && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>+{colors.length - DOTS}{p.custom ? ' & custom' : ''}</span>}
        </div>
      )}
      <div className="foot">
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          From {money(from)}{p.salePct > 0 && <s style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--muted2)' }}>{money(was)}</s>}
        </div>
        <div className="acts">
          <button
            type="button"
            className="btn"
            style={{ fontWeight: 600, fontSize: 14, padding: '11px 14px' }}
            onClick={() => (sold ? go('product/' + p.id) : setQv({ id: p.id, sel: normalize(p, { color: cur }, colors) }))}
          >
            {sold ? 'View' : 'Customise'}
          </button>
        </div>
      </div>
    </article>
  );
}
