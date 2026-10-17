import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { Chip, ErrorText, Stepper } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { Configurator } from '../components/Configurator';
import { Ico } from '../components/Flair';
import { useHydrated } from '../sync';
import { get, money, set } from '../store';
import { remote } from '../remote';
import { reviewPhotoUrl } from '../sync';
import { NotifyMe } from '../components/Perks';
import { useT } from '../i18n';
import { blendValid, defaultSelection, fromListPrice, inStock, listPrice, normalize, ratingOf, selectionTint, unitPrice, type Selection } from '../commerce';
import type { Route } from '../router';
import type { Review } from '../types';

const TABS = ['Description', 'Burn and Care', 'Delivery and Returns'];

export function Product({ route }: { route: Route }) {
  const { products, active, reviews, cart, settings, wish, toggleWish, addCandle, colors, categories } = useApp();
  const t = useT();
  const pp = products.find((x) => String(x.id) === route.arg);
  const [pick, setPick] = useState<Selection | null>(null);
  const [tab, setTab] = useState(0);
  const [img, setImg] = useState(0);
  const hydrated = useHydrated();
  const ctaRef = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  });

  // reset selections whenever a different product is opened
  useEffect(() => {
    if (!pp) return;
    setPick(defaultSelection(pp, colors)); setTab(0); setImg(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.arg, pp?.id]);

  if (!pp && !hydrated) {
    return (
      <section className="page"><div className="layout-half"><div className="skel" style={{ aspectRatio: '1', minHeight: 0 }} /><div className="stack" style={{ gap: 16 }}><div className="skel" style={{ height: 48, minHeight: 0 }} /><div className="skel" style={{ height: 28, minHeight: 0, width: '40%' }} /><div className="skel" style={{ height: 140, minHeight: 0 }} /></div></div></section>
    );
  }
  if (!pp) {
    return (
      <section className="page" style={{ textAlign: 'center' }}>
        <h1 className="h1">{t('Candle not found')}</h1>
        <p className="muted">{t('It may have been removed.')}</p>
        <a href="/shop" className="btn">{t('Back to Shop')}</a>
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
  const photos = pp.images ?? [];
  const imgLabels = ['Front', 'Lit, close-up', 'In a room', 'Packaging'];
  const tabText = [
    pp.desc,
    t('Poured by hand from high quality, non-toxic soy wax with a cotton wick. Trim the wick to 5mm before each burn and let the wax melt across the surface on the first burn. Never leave a burning candle unattended.'),
    'Standard delivery ' + money(settings.standard) + ', free over ' + money(settings.freeOver) + '. Each candle is poured to order, so please allow a few days before dispatch.',
  ][tab];
  const stockText = sold ? t('Sold out') : pp.stock === null ? t('Made to order') : available <= 0 ? t('All available stock is in your basket') : pp.stock <= 5 ? t('Only {n} left', { n: pp.stock }) : t('In stock');

  return (
    <>
      <section className="page">
        <div className="crumb">{t('Home / Shop /')}{' '}{cat ? cat + ' / ' : ''}{pp.name}</div>
        <div className="layout-half" style={{ marginTop: 16 }}>
          {photos.length > 0 ? (
            <div className="stack" style={{ gap: 12 }}>
              <div className="gal-main"><img key={img} src={photos[Math.min(img, photos.length - 1)]} alt={pp.name} /></div>
              {photos.length > 1 && (
                <div className="gal-thumbs">
                  {photos.map((u, i) => <button key={u + i} type="button" className={img === i ? 'on' : ''} onClick={() => setImg(i)} aria-label={'Photo ' + (i + 1)}><img src={u} alt="" loading="lazy" /></button>)}
                </div>
              )}
            </div>
          ) : (
          <div className="stack" style={{ gap: 12 }}>
            <div className="ph ph-art" style={{ backgroundColor: tint, aspectRatio: '1', borderRadius: 22, border: '1px solid var(--line)', padding: 16 }}>{pp.name}: {t(imgLabels[img])}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {imgLabels.map((l, i) => (
                <button key={l} type="button" onClick={() => setImg(i)} aria-label={l} className="ph-art" style={{ aspectRatio: '1', borderRadius: 12, cursor: 'pointer', border: `2px solid ${img === i ? 'var(--brown)' : 'transparent'}`, backgroundColor: tint, fontSize: 10, color: 'var(--text2)', padding: 4, textAlign: 'left', display: 'flex', alignItems: 'flex-end' }}>{l}</button>
              ))}
            </div>
          </div>
          )}

          <div className="stack" style={{ gap: 16 }}>
            <div>
              <h1 className="h1">{pp.name}</h1>
              <div className="muted" style={{ marginTop: 4 }}>{rt.n ? t(rt.n === 1 ? '{avg} / 5 from {n} review' : '{avg} / 5 from {n} reviews', { avg: rt.avg.toFixed(1), n: rt.n }) : t('No reviews yet')}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {money(unit)}
              {pp.salePct > 0 && <><s style={{ marginLeft: 10, fontSize: 16, fontWeight: 400, color: 'var(--muted2)' }}>{money(listPrice(pp, sel))}</s><span className="tagpill sale" style={{ marginLeft: 8 }}>-{pp.salePct}%</span></>}
            </div>
            <div style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)' }}>{pp.blurb}</div>
            <Configurator p={pp} sel={sel} onChange={setPick} />
            <div style={{ fontSize: 14, fontWeight: 500, color: !sold && (pp.stock === null || pp.stock > 5) ? 'var(--green)' : 'var(--amber)' }}>{stockText}</div>
            {sold && <NotifyMe pid={pp.id} name={pp.name} />}
            <div ref={ctaRef} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Stepper qty={sel.qty} onDec={() => setPick({ ...sel, qty: Math.max(1, sel.qty - 1) })} onInc={() => setPick({ ...sel, qty: Math.min(Math.max(1, available), sel.qty + 1) })} />
              <button type="button" className={'btn' + (sold || !blendValid(sel) ? ' disabled' : '')} onClick={() => addCandle(pp.id, sel)} style={{ flex: 1, minWidth: 160 }}>
                {sold ? t('Sold Out') : t('Add to Basket')}
              </button>
              <button type="button" className="btn ghost" onClick={() => toggleWish(pp.id)} aria-pressed={saved}>{saved ? t('Saved') : t('Save')}</button>
            </div>
            <div className="assure">
              <div><Ico n="leaf" />{t('Natural, non-toxic soy wax')}</div>
              <div><Ico n="hand" />{t('Hand-poured to order')}</div>
              <div><Ico n="truck" />{t('Delivery across Sri Lanka')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', marginTop: 8 }} role="tablist">
              {TABS.map((tb, i) => (
                <button key={tb} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} style={{ font: '500 14px Inter', padding: '8px 12px', border: 'none', borderBottom: `2px solid ${tab === i ? 'var(--brown)' : 'transparent'}`, background: 'none', color: 'var(--ink)', cursor: 'pointer' }}>{t(tb)}</button>
              ))}
            </div>
            <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--text2)' }}>{tabText}</div>
          </div>
        </div>
      </section>

      {sticky && !sold && (
        <div className="sticky-cta" role="region" aria-label={t('Add to basket')}>
          <div><div className="nm">{pp.name}</div><div className="pr">{money(unit * sel.qty)}</div></div>
          <button type="button" className={'btn' + (blendValid(sel) ? '' : ' disabled')} onClick={() => addCandle(pp.id, sel)}>{t('Add to Basket')}</button>
        </div>
      )}

      <section className="band-white">
        <div className="page">
          <h2 className="h2" style={{ marginBottom: 24 }}>{t('Reviews')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            {mine.map((r) => (
              <figure key={r.id} style={{ margin: 0, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--amber)' }}>{r.stars} / 5{r.verified && <span className="verified">{t('Verified buyer')}</span>}</div>
                <blockquote style={{ margin: 0, fontSize: 16, lineHeight: '24px' }}>{r.q}</blockquote>
                {!!r.photos?.length && <div className="rv-photos">{r.photos.map((p) => <a key={p} href={reviewPhotoUrl(p)} target="_blank" rel="noreferrer"><img src={reviewPhotoUrl(p)} alt={t('Photo from a customer')} loading="lazy" /></a>)}</div>}
                <figcaption className="muted">{r.who} · {r.date}</figcaption>
              </figure>
            ))}
            {mine.length === 0 && <div className="muted">{t('No reviews yet.')}</div>}
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>{t('Bought this candle? You can review it, with photos, from your order page once it has arrived.')}</p>
        </div>
      </section>

      <section className="page">
        <h2 className="h2" style={{ marginBottom: 24 }}>{t('You May Also Like')}</h2>
        <div className="pgrid">
          {active.filter((p) => p.id !== pp.id).slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </>
  );
}
