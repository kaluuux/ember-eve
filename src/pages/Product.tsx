import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Chip, ErrorText, Stepper } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { Configurator } from '../components/Configurator';
import { get, money, set } from '../store';
import { blendValid, defaultSelection, fromListPrice, inStock, listPrice, normalize, ratingOf, selectionTint, unitPrice, type Selection } from '../commerce';
import type { Route } from '../router';
import type { Review } from '../types';

const TABS = ['Description', 'Burn and Care', 'Delivery and Returns'];

export function Product({ route }: { route: Route }) {
  const { products, active, reviews, cart, settings, wish, toggleWish, addCandle, user, colors, categories } = useApp();
  const pp = products.find((x) => String(x.id) === route.arg);
  const [pick, setPick] = useState<Selection | null>(null);
  const [tab, setTab] = useState(0);
  const [img, setImg] = useState(0);
  const [rvStars, setRvStars] = useState(5);
  const [rvq, setRvq] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // reset selections whenever a different product is opened
  useEffect(() => {
    if (!pp) return;
    setPick(defaultSelection(pp, colors)); setTab(0); setImg(0); setErr(''); setOk(''); setRvq('');
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

  const sel = normalize(pp, pick ?? {}, colors);
  const inBasket = cart.filter((x) => x.pid === pp.id).reduce((a, x) => a + x.qty, 0);
  const available = pp.stock === null ? 10 : pp.stock - inBasket;
  const rt = ratingOf(reviews, pp.id);
  const mine = reviews.filter((r) => r.pid === pp.id);
  const saved = wish.includes(pp.id);
  const tint = selectionTint(sel, colors);
  const unit = unitPrice(pp, sel, settings);
  const sold = !inStock(pp);
  const cat = categories.find((c) => c.id === pp.cat)?.name;
  const imgLabels = ['Front', 'Lit, close-up', 'In a room', 'Packaging'];
  const tabText = [
    pp.desc,
    'Poured by hand from high quality, non-toxic soy wax with a cotton wick. Trim the wick to 5mm before each burn and let the wax melt across the surface on the first burn. Never leave a burning candle unattended.',
    'Standard delivery ' + money(settings.standard) + ', free over ' + money(settings.freeOver) + '. Each candle is poured to order, so please allow a few days before dispatch.',
  ][tab];
  const stockText = sold ? 'Sold out' : pp.stock === null ? 'Made to order' : available <= 0 ? 'All available stock is in your basket' : pp.stock <= 5 ? 'Only ' + pp.stock + ' left' : 'In stock';

  const submitReview = () => {
    if (!rvq.trim() || !user) return setErr('Write a few words first.');
    set<Review[]>('reviews', get<Review[]>('reviews', []).concat({ id: Date.now(), pid: pp.id, who: user.name, stars: rvStars, q: rvq.trim(), date: new Date().toISOString().slice(0, 10), approved: false }));
    setRvq(''); setErr(''); setOk('Thank you. Your review will appear once approved.');
  };

  return (
    <>
      <section className="page">
        <div className="crumb">Home / Shop / {cat ? cat + ' / ' : ''}{pp.name}</div>
        <div className="layout-half" style={{ marginTop: 16 }}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="ph" style={{ background: tint, aspectRatio: '1', borderRadius: 16, border: '1px solid var(--line)', padding: 16 }}>{pp.name}: {imgLabels[img]}</div>
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
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {money(unit)}
              {pp.salePct > 0 && <><s style={{ marginLeft: 10, fontSize: 16, fontWeight: 400, color: 'var(--muted2)' }}>{money(listPrice(pp, sel))}</s><span className="tagpill sale" style={{ marginLeft: 8 }}>-{pp.salePct}%</span></>}
            </div>
            <div style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)' }}>{pp.blurb}</div>
            <Configurator p={pp} sel={sel} onChange={setPick} />
            <div style={{ fontSize: 14, fontWeight: 500, color: !sold && (pp.stock === null || pp.stock > 5) ? 'var(--green)' : 'var(--amber)' }}>{stockText}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Stepper qty={sel.qty} onDec={() => setPick({ ...sel, qty: Math.max(1, sel.qty - 1) })} onInc={() => setPick({ ...sel, qty: Math.min(Math.max(1, available), sel.qty + 1) })} />
              <button type="button" className={'btn' + (sold || !blendValid(sel) ? ' disabled' : '')} onClick={() => addCandle(pp.id, sel)} style={{ flex: 1, minWidth: 160 }}>
                {sold ? 'Sold Out' : 'Add to Basket'}
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
