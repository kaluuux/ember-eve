import { Hero } from '../components/Hero';
import { ProductCard } from '../components/ProductCard';
import { ColourStudio } from '../components/ColourStudio';
import { Embers, Ico, Newsletter, Reveal } from '../components/Flair';
import { useApp } from '../AppContext';
import { Ph } from '../components/ui';
import { SHELVES } from '../commerce';
import type { Product } from '../types';

export const INGREDIENTS = [
  { v: '100%', t: 'High quality soy wax', d: 'Non-toxic, clean burning and gentle on your home. Every candle is poured by hand with care and attention to detail.' },
  { v: '15+', t: 'Colours, or blend your own', d: 'Pick from fifteen shades, or mix two or more for a colour that is yours alone.' },
  { v: '100%', t: 'Cotton wicks', d: 'Lead-free and sized to each candle for a full, even melt.' },
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
        <h2 className="h2" style={{ marginBottom: 24, color: '#fff' }}>What's Inside</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          {INGREDIENTS.map((i) => (
            <div key={i.t} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 44, fontWeight: 600, lineHeight: 1.1 }}>{i.v}</div>
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
        <Reveal className="sec-head">
          <div>
            <h2 className="h2">{title}</h2>
            <p>{blurb}</p>
          </div>
          <a href={'#/' + href} className="btn ghost sm">View all{items.length > 4 ? ' (' + items.length + ')' : ''}</a>
        </Reveal>
        <Reveal stagger className="pgrid shelf">{items.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</Reveal>
      </div>
    </section>
  );
}

const PROMISES: { ic: 'leaf' | 'hand' | 'palette' | 'gift'; h: string; t: string }[] = [
  { ic: 'leaf', h: 'Natural soy wax', t: 'Non-toxic and clean burning, gentle on your home.' },
  { ic: 'hand', h: 'Hand-poured', t: 'Small batches, set slowly and finished by hand.' },
  { ic: 'palette', h: 'Your colours', t: 'Fifteen shades, or blend your own.' },
  { ic: 'gift', h: 'Gift ready', t: 'Custom gift boxes and personal sticker messages.' },
];
const TILE_TINTS = ['linear-gradient(150deg,#F7E4E7,#EBC9D0)', 'linear-gradient(150deg,#E6ECF6,#C9D6EA)', 'linear-gradient(150deg,#F8EDD0,#EBD39B)', 'linear-gradient(150deg,#E4EEDD,#C5D8BC)'];

export function Home() {
  const { reviews, categories, liveSeasons, active, shelf } = useApp();
  return (
    <>
      <Hero />

      <section className="promise" aria-label="Why Ember & Eve">
        <Reveal stagger className="promise-grid">
          {PROMISES.map((p) => (
            <div key={p.h} className="promise-item">
              <span className="ic"><Ico n={p.ic} /></span>
              <div><b>{p.h}</b><span>{p.t}</span></div>
            </div>
          ))}
        </Reveal>
      </section>

      {liveSeasons.map((se) => (
        <ShelfSection key={se.id} title={se.name} blurb={se.blurb} href={'shop?season=' + se.id} items={active.filter((p) => p.season === se.id)} tinted />
      ))}

      {categories.length > 0 && (
        <section className="page" style={{ paddingTop: 80 }}>
          <Reveal className="sec-head center-head">
            <span className="eyebrow">Our collection</span>
            <h2 className="h2">Find your kind of calm</h2>
            <p>Sculpted moulds, poured glass and classic jars.</p>
          </Reveal>
          <Reveal stagger className="cat-tiles">
            {categories.map((c, i) => {
              const n = active.filter((p) => p.cat === c.id).length;
              return (
                <a key={c.id} href={'#/shop?cat=' + c.id} className="cat-tile">
                  <div className="art" style={{ background: TILE_TINTS[i % 4], color: 'var(--brown)' }}><Ico n="flame" /></div>
                  <span className="go"><Ico n="arrow" /></span>
                  <div className="body">
                    <div className="name">{c.name}</div>
                    <div className="muted" style={{ margin: '6px 0 8px', lineHeight: 1.5 }}>{c.blurb}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brown)' }}>{n} {n === 1 ? 'candle' : 'candles'}</div>
                  </div>
                </a>
              );
            })}
          </Reveal>
        </section>
      )}

      <ColourStudio />

      {SHELVES.map((sh, i) => <ShelfSection key={sh.id} title={sh.title} blurb={sh.blurb} href={'shop?shelf=' + sh.id} items={shelf(sh.id)} tinted={i % 2 === 1} />)}

      <section>
        <div className="story">
          <Reveal className="story-art">
            <Embers n={18} />
            <svg viewBox="0 0 120 200" fill="none" stroke="#fff" strokeOpacity=".92" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M60 20c10 14 14 22 14 30a14 14 0 0 1-28 0c0-8 4-16 14-30Z" fill="rgba(255,255,255,.35)" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%', animation: 'flame 1.8s ease-in-out infinite' }} />
              <path d="M60 64v14" />
              <path d="M24 84h72v82a12 12 0 0 1-12 12H36a12 12 0 0 1-12-12V84Z" fill="rgba(255,255,255,.16)" />
              <path d="M24 100h72" strokeOpacity=".5" />
            </svg>
          </Reveal>
          <Reveal delay={120}>
            <span className="eyebrow">Our craft</span>
            <h2 className="h2">Poured slowly, by hand</h2>
            <p className="lede" style={{ margin: '16px 0 0' }}>
              Every Ember &amp; Eve candle is made in Sri Lanka, in small batches, from high quality soy wax. We pour, colour and finish each one ourselves, so it arrives the way you imagined it.
            </p>
            <ul>
              <li>Non-toxic soy wax and lead-free cotton wicks</li>
              <li>Your choice of colour, scent or no scent at all</li>
              <li>Sticker messages and gift boxes, made just for you</li>
            </ul>
            <a href="#/about" className="btn ghost">Read our story</a>
          </Reveal>
        </div>
      </section>

      <section className="gift-band">
        <Embers n={16} />
        <Reveal className="inner">
          <div>
            <span className="eyebrow" style={{ color: '#E6C79A' }}>Gift something thoughtful</span>
            <h2 className="h2">Create your own gift box</h2>
            <p>Pick the candles, choose every colour, add a personal note, and we wrap it all up beautifully.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="#/gifts" className="btn light">Build a gift box</a>
            <a href="#/finder" className="btn ghost-light">Find my colour</a>
          </div>
        </Reveal>
      </section>

      <section id="gallery" className="page-72">
        <Reveal className="sec-head center-head">
          <span className="eyebrow">From the studio</span>
          <h2 className="h2">Little moments, lit</h2>
        </Reveal>
        <Reveal stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24 }}>
          {GALLERY.map((g) => (
            <Ph key={g.t} tint={g.tint} label={g.t} ratio={g.ratio} style={{ border: '1px solid var(--line)' }} className="gallery-tile" />
          ))}
        </Reveal>
      </section>

      {reviews.length > 0 && (
        <section id="reviews" className="band-white">
          <div className="page-72">
            <Reveal className="sec-head center-head">
              <span className="eyebrow">Kind words</span>
              <h2 className="h2">Loved by our customers</h2>
            </Reveal>
            <Reveal stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
              {reviews.slice(0, 3).map((r) => (
                <figure key={r.id} className="quote-card">
                  <div className="stars" aria-label={r.stars + ' out of 5'}>{'★'.repeat(r.stars)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - r.stars)}</span></div>
                  <blockquote>{r.q}</blockquote>
                  <figcaption><span className="avatar">{r.who.trim().charAt(0).toUpperCase()}</span>{r.who}</figcaption>
                </figure>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      <section className="news-band">
        <Reveal className="inner">
          <span className="eyebrow">The Ember &amp; Eve circle</span>
          <h2 className="h2">Be the first to know</h2>
          <p className="lede" style={{ margin: '12px 0 0' }}>New collections, seasonal candles and the occasional offer. Never more than once a month.</p>
          <Newsletter />
        </Reveal>
      </section>
    </>
  );
}
