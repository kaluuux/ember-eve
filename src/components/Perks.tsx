import { useRef, useState } from 'react';
import { Chip, ErrorText } from './ui';
import { useT } from '../i18n';
import { requestCancel, requestStockAlert, reviewPhotoUrl, submitReview, uploadReviewPhoto } from '../sync';
import type { Order } from '../types';

/** "Tell me when it is back" for a sold-out candle. Takes an email address or a mobile number. */
export function NotifyMe({ pid, name }: { pid: number; name: string }) {
  const t = useT();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const e = await requestStockAlert(pid, v.trim());
    setBusy(false);
    if (e) return setErr(t(e));
    setErr(''); setDone(true);
  };
  if (done) return <div className="ok">{t('Thank you. We will message you as soon as {name} is back.', { name })}</div>;
  return (
    <div className="notify-me stack" style={{ gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{t('Sold out for now. Want to know when it is back?')}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 220px' }} value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} placeholder={t('Email or mobile number')} aria-label={t('Email or mobile number')} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
        <button type="button" className="btn" onClick={send} disabled={busy || !v.trim()}>{busy ? t('Saving…') : t('Notify me')}</button>
      </div>
      <ErrorText>{err}</ErrorText>
    </div>
  );
}

/** Ask the shop to cancel an order that has not been dispatched. The shop decides. */
export function CancelAsk({ o }: { o: Order }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = sent || o.cancelRequest?.state === 'pending';
  if (o.status !== 'Processing' && !pending) return null;
  if (o.status === 'Cancelled') return null;
  if (pending) return <div className="notice-soft"><div>{t('You asked us to cancel this order. We will confirm by message soon. If it has not been poured yet we will cancel it and refund any payment.')}</div></div>;
  const send = async () => {
    setBusy(true);
    const e = await requestCancel(o.id, o.email, why.trim());
    setBusy(false);
    if (e) return setErr(t(e));
    setSent(true);
  };
  return (
    <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
      {o.cancelRequest?.state === 'declined' && <div className="muted" style={{ fontSize: 13 }}>{t('We could not cancel this order because it is already being made.')}</div>}
      {!open ? <button type="button" className="link-btn" onClick={() => setOpen(true)}>{t('Need to cancel this order?')}</button> : (
        <div className="stack" style={{ gap: 8, width: '100%', maxWidth: 460 }}>
          <textarea className="input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t('Tell us why (optional)')} aria-label={t('Reason')} />
          <ErrorText>{err}</ErrorText>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn sm danger" onClick={send} disabled={busy}>{busy ? t('Sending…') : t('Ask to cancel')}</button>
            <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>{t('Keep my order')}</button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{t('Candles are poured to order, so we can only cancel before the order is dispatched.')}</div>
        </div>
      )}
    </div>
  );
}

/** After delivery: review what you bought, with photos. The server checks you really bought it. */
export function ReviewBox({ o }: { o: Order }) {
  const t = useT();
  const seen = new Map<number, string>();
  o.items.forEach((i) => {
    if (i.kind === 'giftcard') return;
    if (i.box?.length) i.box.forEach((c) => { if (c.pid && !seen.has(c.pid)) seen.set(c.pid, c.name); });
    else if (i.pid && !seen.has(i.pid)) seen.set(i.pid, i.name);
  });
  if (o.status !== 'Delivered' || seen.size === 0) return null;
  return (
    <section className="card stack" style={{ marginTop: 24, gap: 16 }}>
      <div>
        <div className="h3">{t('How was it?')}</div>
        <div className="muted" style={{ fontSize: 14 }}>{t('Your review appears on the candle page as a verified buyer once we have read it. Photos are welcome.')}</div>
      </div>
      {[...seen.entries()].map(([pid, name]) => <OneReview key={pid} o={o} pid={pid} name={name} />)}
    </section>
  );
}

function OneReview({ o, pid, name }: { o: Order; pid: number; name: string }) {
  const t = useT();
  const [stars, setStars] = useState(5);
  const [q, setQ] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const who = (o.first || o.name.split(' ')[0]) + (o.address.city ? ', ' + o.address.city : '');

  const add = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true); setErr('');
    for (const f of Array.from(files).slice(0, 3 - photos.length)) {
      const r = await uploadReviewPhoto(o.id, f);
      if (r.error) { setErr(t(r.error)); break; }
      setPhotos((p) => (p.length < 3 ? p.concat(r.path) : p));
    }
    setBusy(false);
  };
  const send = async () => {
    if (q.trim().length < 3) return setErr(t('Add a few words about it.'));
    setBusy(true);
    const e = await submitReview({ orderId: o.id, email: o.email, pid, stars, q: q.trim(), photos, who });
    setBusy(false);
    if (e) { if (/already/.test(e)) setDone(true); return setErr(t(e)); }
    setDone(true); setErr('');
  };
  if (done) return <div className="ok">{t('Thank you for reviewing {name}.', { name })}</div>;
  return (
    <div className="stack" style={{ gap: 10, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <b>{name}</b>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[5, 4, 3, 2, 1].map((n) => <Chip key={n} size="lg" on={stars === n} onClick={() => setStars(n)}>{n} ★</Chip>)}
      </div>
      <textarea className="input" rows={3} value={q} onChange={(e) => { setQ(e.target.value); setErr(''); }} placeholder={t('Share how it burned and smelled')} aria-label={t('Your review of {name}', { name })} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {photos.map((p) => <span key={p} className="rv-thumb"><img src={reviewPhotoUrl(p)} alt="" /><button type="button" aria-label={t('Remove photo')} onClick={() => setPhotos(photos.filter((x) => x !== p))}>×</button></span>)}
        {photos.length < 3 && (
          <>
            <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => file.current?.click()}>{t('Add photos')}</button>
          </>
        )}
      </div>
      <ErrorText>{err}</ErrorText>
      <div><button type="button" className="btn" onClick={send} disabled={busy}>{busy ? t('Sending…') : t('Send review')}</button></div>
    </div>
  );
}
