import { Hero } from '../components/Hero';
import { ProductCard } from '../components/ProductCard';
import { useApp } from '../AppContext';
import { Ph } from '../components/ui';
import { money } from '../store';
import { SHELVES } from '../commerce';
import type { Product } from '../types';

export const INGREDIENTS = [
  { v: '100%', t: 'High quality soy wax', d: 'Non-toxic, clean burning and gentle on your home. Every candle is poured by hand with care and attention to detail.' },
  { v: '15+', t: 'Colours, or blend your own', d: 'Pick from fifteen shades, or mix two or more for a colour that is yours alone.' },
  { v: '100%', t: 'Cotton wicks', d: 'Lead-free and sized to each shape for a full, even melt.' },
];

const GALLERY = [
  { t: 'Jar candles on a windowsill', ratio: '4/5', tint: '#EADFD3' },
  { t: 'Butterfly candle close-up', ratio: '1', tint: '#EDE9FE' },
  { t: 'Pouring day', ratio: '4/5', tint: '#FEF3C7' },
  { t: 'Heart candle gift wrap', ratio: '1', tint: '#FCE7F3' },
  { t: 'Bubble candle, lit', ratio: '4/5', tint: '#E0E7FF' },
  { t: 'Flower candle in bloom', ratio: '1', tint: '#FFEDD5' },
];

export function WhatsInside() {
  return (
    <section id="ingredients" className="band-dark">
      <div className="page-72">
        <h2 className="h2" style={{ marginBottom: 24 }}>What's Inside</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          {INGREDIENTS.map((i) => (
            <div key={i.t} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: '44px' }}>{i.v}</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{i.t}</div>
              <div style={{ fontSize: 14, lineHeight: '22px', color: '#D9CCBF' }}>{i.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A titled row of up to four products. Renders nothing when there is nothing to show, so empty shelves never appear. */
function ShelfSection({ title, blurb, href, items, tinted }: { title: string; blurb: string; href: string; items: Product[]; tinted?: boolean }) {
  if (!items.length) return null;
  return (
    <section className={tinted ? 'band-white' : undefined}>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <div>
            <h2 className="h2">{title}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>{blurb}</p>
          </div>
          <a href={'#/' + href} className="btn ghost">View All{items.length > 4 ? ' (' + items.length + ')' : ''}</a>
        </div>
        <div className="pgrid shelf">{items.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </div>
    </section>
  );
}

export function Home() {
  const { settings, reviews, categories, liveSeasons, active, shelf } = useApp();
  const trust = [
    { h: 'Free delivery', t: 'On orders over ' + money(settings.freeOver) },
    { h: 'Hand-poured', t: 'Small batches, cured for 14 days' },
    { h: 'Soy wax, non-toxic', t: 'Poured by hand, with care' },
    { h: 'Made in Sri Lanka', t: 'Pickup, bank transfer or card' },
  ];
  return (
    <>
      <Hero />

      <section style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24 }}>
          {trust.map((t) => (
            <div key={t.h}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{t.h}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>{t.t}</div>
            </div>
          ))}
        </div>
      </section>

      {liveSeasons.map((se) => (
        <ShelfSection key={se.id} title={se.name} blurb={se.blurb} href={'shop?season=' + se.id} items={active.filter((p) => p.season === se.id)} tinted />
      ))}

      {categories.length > 0 && <section className="page">
        <h2 className="h2" style={{ marginBottom: 24 }}>Shop by Type</h2>
        <div className="cat-tiles">
          {categories.map((c, i) => {
            const n = active.filter((p) => p.cat === c.id).length;
            return (
              <a key={c.id} href={'#/shop?cat=' + c.id} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                <Ph tint={['#FCE7F3', '#E0E7FF', '#FEF3C7', '#DCFCE7'][i % 4]} label={c.name} ratio="3/2" style={{ borderRadius: 8 }} />
                <div style={{ padding: '0 4px 4px' }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 14, margin: '4px 0' }}>{c.blurb}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown)' }}>{n} {n === 1 ? 'candle' : 'candles'}</div>
                </div>
              </a>
            );
          })}
        </div>
      </section>}

      {SHELVES.map((sh) => <ShelfSection key={sh.id} title={sh.title} blurb={sh.blurb} href={'shop?shelf=' + sh.id} items={shelf(sh.id)} />)}

      <section className="band-dark">
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h2 className="h2">Not sure where to start?</h2>
            <p style={{ margin: '8px 0 0', fontSize: 16, color: '#D9CCBF' }}>Answer two questions and we will suggest a candle.</p>
          </div>
          <a href="#/finder" style={{ background: '#fff', color: '#7A5636', textDecoration: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 600 }}>Find My Scent</a>
        </div>
      </section>

      <WhatsInside />

      <section id="gallery" className="page-72">
        <h2 className="h2" style={{ marginBottom: 24 }}>Gallery</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24 }}>
          {GALLERY.map((g) => (
            <Ph key={g.t} tint={g.tint} label={g.t} ratio={g.ratio} style={{ borderRadius: 16, border: '1px solid var(--line)' }} />
          ))}
        </div>
      </section>

      <section id="reviews" className="band-white">
        <div className="page-72">
          <h2 className="h2" style={{ marginBottom: 24 }}>Kind Words</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            {reviews.slice(0, 3).map((r) => (
              <figure key={r.id} style={{ margin: 0, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--amber)' }}>{r.stars} / 5</div>
                <blockquote style={{ margin: 0, fontSize: 16, lineHeight: '24px' }}>{r.q}</blockquote>
                <figcaption style={{ fontSize: 14, color: 'var(--muted2)' }}>{r.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
