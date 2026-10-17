import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Chip, ErrorText, Ph, Stepper } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { WAX, get, money, scentOf, set } from '../store';
import { firstInStock, ratingOf } from '../commerce';
import type { Route } from '../router';
import type { Review } from '../types';

const TABS = ['Description', 'Burn and Care', 'Delivery and Returns'];

export function Product({ route }: { route: Route }) {
  const { products, active, reviews, cart, settings, wish, toggleWish, addCandle, user } = useApp();
  const pp = products.find((x) => String(x.id) === route.arg);
  const [scent, setScent] = useState('');
  const [si, setSi] = useState(0);
  const [wi, setWi] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState(0);
  const [img, setImg] = useState(0);
  const [rvStars, setRvStars] = useState(5);
  const [rvq, setRvq] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // reset selections whenever a different product is opened
  useEffect(() => {
    if (!pp) return;
    setScent(pp.scents[0]); setSi(firstInStock(pp)); setWi(0); setQty(1); setTab(0); setImg(0); setErr(''); setOk(''); setRvq('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.arg, pp?.id]);

  if (!pp) {
    return (
      <section className="page" style={{ textAlign: 'center' }}>
        <h1 className="h1">Candle not found</h1>
        <p className="muted">It may have been removed.</p>
        <a href="#/shop" className="btn">Back to Shop</a>
      </section>
    );
  }

  const cur = pp.scents.includes(scent) ? scent : pp.scents[0];
  const z = pp.sizes[Math.min(si, pp.sizes.length - 1)];
  const inBasket = cart.filter((x) => x.pid === pp.id && x.si === si).reduce((a, x) => a + x.qty, 0);
  const available = z.stock - inBasket;
  const rt = ratingOf(reviews, pp.id);
  const mine = reviews.filter((r) => r.pid === pp.id);
  const saved = wish.includes(pp.id);
  const tint = scentOf(cur).tint;
  const imgLabels = ['Front, ' + cur, 'Lit, close-up', 'In a room', 'Packaging'];
  const tabText = [
    pp.desc,
    'Trim the wick to 5mm before each burn. Let the wax melt fully across the surface on the first burn. Never leave a burning candle unattended.',
    'Standard delivery ' + money(settings.standard) + ', free over ' + money(settings.freeOver) + '. Returns accepted within 30 days on unused candles.',
  ][tab];
  const stockText = z.stock <= 0 ? 'Sold out' : available <= 0 ? 'All available stock is in your basket' : z.stock <= 5 ? 'Only ' + z.stock + ' left' : 'In stock · burn time ' + z.burn;

  const submitReview = () => {
    if (!rvq.trim() || !user) return setErr('Write a few words first.');
    set<Review[]>('reviews', get<Review[]>('reviews', []).concat({ id: Date.now(), pid: pp.id, who: user.name, stars: rvStars, q: rvq.trim(), date: new Date().toISOString().slice(0, 10), approved: false }));
    setRvq(''); setErr(''); setOk('Thank you. Your review will appear once approved.');
  };

  return (
    <>
      <section className="page">
        <div className="crumb">Home / Shop / {pp.name}</div>
        <div className="layout-half" style={{ marginTop: 16 }}>
          <div className="stack" style={{ gap: 12 }}>
            <Ph tint={tint} label={imgLabels[img]} ratio="1" style={{ borderRadius: 16, border: '1px solid var(--line)', padding: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {imgLabels.map((l, i) => (
                <button key={l} type="button" onClick={() => setImg(i)} aria-label={l} style={{ aspectRatio: '1', borderRadius: 8, cursor: 'pointer', border: `2px solid ${img === i ? 'var(--brown)' : 'transparent'}`, background: tint, fontSize: 10, color: 'var(--text2)', padding: 4, textAlign: 'left', display: 'flex', alignItems: 'flex-end' }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="stack" style={{ gap: 16 }}>
            <div>
              <h1 className="h1">{pp.name}</h1>
              <div className="muted" style={{ marginTop: 4 }}>{rt.n ? rt.avg.toFixed(1) + ' / 5 from ' + rt.n + (rt.n === 1 ? ' review' : ' reviews') : 'No reviews yet'}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{money(z.p + WAX[wi].add)}</div>
            <div style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)' }}>{pp.blurb}</div>
            <div>
              <div className="label-s">Scent: {cur}, {scentOf(cur).note.toLowerCase()}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pp.scents.map((n) => <Chip key={n} size="lg" on={n === cur} onClick={() => setScent(n)}>{n}</Chip>)}
              </div>
            </div>
            <div>
              <div className="label-s">Size</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pp.sizes.map((s, i) => <Chip key={s.l} size="wide" on={i === si} onClick={() => { setSi(i); setQty(1); }}>{s.l} · {money(s.p)}{s.stock <= 0 ? ' · Sold out' : ''}</Chip>)}
              </div>
            </div>
            <div>
              <div className="label-s">Wax</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {WAX.map((w, i) => <Chip key={w.l} size="wide" on={i === wi} onClick={() => setWi(i)}>{w.l}{w.add ? ` (+${money(w.add)})` : ''}</Chip>)}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: z.stock <= 5 ? 'var(--amber)' : 'var(--green)' }}>{stockText}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Stepper qty={qty} onDec={() => setQty(Math.max(1, qty - 1))} onInc={() => setQty(Math.min(Math.max(1, available), qty + 1))} />
              <button type="button" className={'btn' + (z.stock <= 0 ? ' disabled' : '')} onClick={() => addCandle(pp.id, cur, si, wi, qty)} style={{ flex: 1, minWidth: 160 }}>
                {z.stock <= 0 ? 'Sold Out' : 'Add to Basket'}
              </button>
              <button type="button" className="btn ghost" onClick={() => toggleWish(pp.id)} aria-pressed={saved}>{saved ? 'Saved' : 'Save'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', marginTop: 8 }} role="tablist">
              {TABS.map((t, i) => (
                <button key={t} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} style={{ font: '500 14px Inter', padding: '8px 12px', border: 'none', borderBottom: `2px solid ${tab === i ? 'var(--brown)' : 'transparent'}`, background: 'none', color: 'var(--ink)', cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
            <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--text2)' }}>{tabText}</div>
          </div>
        </div>
      </section>

      <section className="band-white">
        <div className="page">
          <h2 className="h2" style={{ marginBottom: 24 }}>Reviews</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            {mine.map((r) => (
              <figure key={r.id} style={{ margin: 0, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--amber)' }}>{r.stars} / 5</div>
                <blockquote style={{ margin: 0, fontSize: 16, lineHeight: '24px' }}>{r.q}</blockquote>
                <figcaption className="muted">{r.who} · {r.date}</figcaption>
              </figure>
            ))}
            {mine.length === 0 && <div className="muted">No reviews yet.</div>}
          </div>
          <div className="card" style={{ marginTop: 24, maxWidth: 560, background: 'var(--bg)' }}>
            <div className="h3" style={{ marginBottom: 12 }}>Write a review</div>
            {user ? (
              <div className="stack" style={{ gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[5, 4, 3, 2, 1].map((n) => <Chip key={n} size="lg" on={rvStars === n} onClick={() => setRvStars(n)}>{n} star{n > 1 ? 's' : ''}</Chip>)}
                </div>
                <textarea className="input" rows={3} value={rvq} onChange={(e) => { setRvq(e.target.value); setErr(''); }} placeholder="Share how it burned and smelled" aria-label="Your review" />
                <ErrorText>{err}</ErrorText>
                <div><button type="button" className="btn" onClick={submitReview}>Submit Review</button></div>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}><a href={'#/login?next=product/' + pp.id}>Sign in</a> to leave a review.</p>
            )}
            {ok && <div className="ok" style={{ marginTop: 12 }}>{ok}</div>}
          </div>
        </div>
      </section>

      <section className="page">
        <h2 className="h2" style={{ marginBottom: 24 }}>You May Also Like</h2>
        <div className="pgrid">
          {active.filter((p) => p.id !== pp.id).slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </>
  );
}
