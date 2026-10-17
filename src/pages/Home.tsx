import { Hero } from '../components/Hero';
import { ProductCard } from '../components/ProductCard';
import { useApp } from '../AppContext';
import { Ph } from '../components/ui';
import { money } from '../store';

export const INGREDIENTS = [
  { v: '82/18', t: 'Soy and coconut wax', d: 'A creamy blend that holds scent and burns evenly. Choose pure soy or the blend on any candle.' },
  { v: '100%', t: 'Cotton wicks', d: 'Lead-free and sized to each shape for a full, even melt.' },
  { v: '5', t: 'Gentle scents', d: 'Vanilla, Strawberry, Jasmine, Lavender and Rosemary, blended in small lots.' },
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

export function Home() {
  const { active, settings, reviews } = useApp();
  const trust = [
    { h: 'Free delivery', t: 'On UK orders over ' + money(settings.freeOver) },
    { h: 'Hand-poured', t: 'Small batches, cured for 14 days' },
    { h: '30-day returns', t: 'Full refund on unused candles' },
    { h: 'Secure checkout', t: 'Card and PayPal accepted' },
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

      <section className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <div>
            <h2 className="h2">Five Shapes, Five Scents</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Choose a shape, then choose a scent.</p>
          </div>
          <a href="#/shop" className="btn ghost">View All</a>
        </div>
        <div className="pgrid five">{active.slice(0, 5).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>

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
