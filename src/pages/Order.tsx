import { useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { lineText, orderView, soft } from '../commerce';
import { get, money, useStored, EMPTY } from '../store';
import { remote } from '../remote';
import { uploadReceipt } from '../sync';
import { ErrorText } from '../components/ui';
import { CancelAsk, ReviewBox } from '../components/Perks';
import { useT } from '../i18n';
import { BankAccounts } from '../components/BankAccounts';
import type { Order as OrderT, Settings } from '../types';
import type { Route } from '../router';

export function Order({ route }: { route: Route }) {
  const { user, settings } = useApp();
  const t = useT();
  const orders = useStored<OrderT[]>('orders', EMPTY);
  const mine = get<string[]>('myorders', []);
  const raw = orders.find((o) => o.id === route.arg);
  const allowed = raw && ((user && (raw.userId === user.id || raw.email === user.email)) || mine.includes(raw.id));
  const ord = allowed && raw ? orderView(raw) : null;

  if (!ord) {
    return (
      <section className="page">
        <div className="card stack" style={{ textAlign: 'center', alignItems: 'center', gap: 12 }}>
          <h1 className="h1">{t('Order not found')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('Sign in to your account, or use Track Order with your order number and email.')}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/login?next=account" className="btn">{t('Sign In')}</a>
            <a href="/track" className="btn ghost">{t('Track Order')}</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      {route.q.new && (
        <div className="card" style={{ marginBottom: 24, background: 'var(--cream)' }}>
          <h1 className="h1">{t('Thank you, {name}.', { name: ord.first || ord.name.split(' ')[0] })}</h1>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--text2)' }}>{t('We have received order {id}. Keep this page or your order number to track it.', { id: ord.id })}</p>
          {!user && (
            <div className="notice-soft">
              <div><b>{t('Want it easier next time?')}</b> {t('Create an account to save your address, see all your orders in one place and buy again in a click. This order will be waiting in your account.')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="btn sm" href={'/register?next=account&email=' + encodeURIComponent(ord.email)}>{t('Create account')}</a>
                <a className="btn ghost sm" href="/login?next=account">{t('Sign in')}</a>
              </div>
            </div>
          )}
        </div>
      )}
      <PaymentPanel o={ord} st={settings} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 className="h2">{t('Order {id}', { id: ord.id })}</h2>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={'/invoice/' + ord.id} className="btn ghost sm">{t('View / print invoice')}</a>
          <span className="tag" style={{ fontSize: 14, background: ord.statusBg, color: ord.statusFg }}>{t(ord.status)}</span>
        </span>
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {ord.timeline.map((tl, i) => (
            <div key={i}>
              <div style={{ height: 6, borderRadius: 9999, background: tl.bg }} />
              <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: tl.fg }}>{t(tl.label)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="layout-main-side">
        <div className="card stack" style={{ gap: 12 }}>
          <div className="h3">{t('Items')}</div>
          {ord.items.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: soft(l.tint), flex: 'none' }} />
              <div style={{ flex: 1, fontSize: 14 }}>
                <div style={{ fontWeight: 500 }}>{l.name}</div>
                <div className="muted">{lineText(l)} · Qty {l.qty}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{money(l.unit * l.qty)}</div>
            </div>
          ))}
        </div>
        <aside className="card stack" style={{ gap: 8, fontSize: 14 }}>
          <div className="h3">{t('Details')}</div>
          <div><b>{t('Placed')}</b><br />{ord.dateL}</div>
          {ord.shipM !== 'digital' && <div><b>{t('Deliver to')}</b><br />{ord.name}<br />{ord.addr}</div>}
          {ord.shipM !== 'digital' && <div><b>{t('Delivery')}</b><br />{t(ord.shipName)}</div>}
          {ord.tracking?.number && (
            <div><b>{t('Tracking')}</b><br />{ord.tracking.courier} {ord.tracking.number}{ord.tracking.url && <> · <a href={ord.tracking.url} target="_blank" rel="noreferrer">{t('Track parcel')}</a></>}</div>
          )}
          {ord.sellerNote && <div><b>Your note to us</b><br />{ord.sellerNote}</div>}
          <div><b>{t('Payment')}</b><br />{ord.pay}</div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}><span>{t('Subtotal')}</span><span>{money(ord.sub)}</span></div>
          {ord.disc > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>{t('Discount')}</span><span>-{money(ord.disc)}</span></div>}
          {!!ord.refDisc && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>{t('Friend discount')}</span><span>-{money(ord.refDisc)}</span></div>}
          {ord.wrap > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Gift wrap')}</span><span>{money(ord.wrap)}</span></div>}
          {ord.shipM !== 'digital' && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Delivery')}</span><span>{ord.shipL}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}><span>{t('Total')}</span><span>{money(ord.total)}</span></div>
          {!!ord.gcApplied && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>{t('Gift card')}</span><span>-{money(ord.gcApplied)}</span></div>}
          {!!ord.creditApplied && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>{t('Store credit')}</span><span>-{money(ord.creditApplied)}</span></div>}
          {(!!ord.gcApplied || !!ord.creditApplied) && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{t('To pay')}</span><span>{money(ord.due ?? ord.total)}</span></div>}
        </aside>
      </div>
      {!!ord.giftCards?.length && ord.payStatus === 'Paid' && <GiftCardCodes o={ord} shop={settings.shop} />}
      <ReviewBox o={ord} />
      <div style={{ marginTop: 24 }}><CancelAsk o={ord} /></div>
      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/shop" className="btn">{t('Continue Shopping')}</a>
        {user && <a href="/account" className="btn ghost">{t('My Orders')}</a>}
      </div>
    </section>
  );
}

type OV = ReturnType<typeof orderView>;

/** The codes for gift cards bought on this order, ready to pass on to the person they are for. */
function GiftCardCodes({ o, shop }: { o: OV; shop: string }) {
  const t = useT();
  const [copied, setCopied] = useState('');
  return (
    <section className="card stack" style={{ marginTop: 24, gap: 12, background: 'var(--cream)' }}>
      <div className="h3">{t('Your gift cards')}</div>
      <div className="muted" style={{ fontSize: 14 }}>{t('Pass each code to the person it is for. They enter it at checkout.')}</div>
      {o.giftCards!.map((g) => {
        const text = (g.to ? 'For ' + g.to + ': ' : '') + 'A ' + shop + ' gift card worth ' + money(g.amount) + '. Use code ' + g.code + ' at checkout: ' + window.location.origin;
        return (
          <div key={g.code} className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span><span className="gc-code" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: 700, letterSpacing: '.04em' }}>{g.code}</span> · {money(g.amount)}{g.to ? ' · ' + g.to : ''}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(g.code); setCopied(g.code); }}>{copied === g.code ? t('Copied') : t('Copy code')}</button>
              <a className="btn ghost sm" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer">{t('Send on WhatsApp')}</a>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Bank transfer instructions, receipt upload and WhatsApp hand-off. Shown until payment is approved. */
function PaymentPanel({ o, st }: { o: OV; st: Settings }) {
  const t = useT();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const wa = st.whatsapp
    ? 'https://wa.me/' + st.whatsapp + '?text=' + encodeURIComponent('Hi ' + st.shop + ', this is order ' + o.id + ' (' + money(o.due ?? o.total) + ') from ' + o.name + '.' + (o.payMethod === 'bank' ? ' I have made the bank transfer and my receipt photo is attached.' : ''))
    : '';

  if (o.status === 'Cancelled') return null;
  const bank = o.payMethod === 'bank';
  const paid = o.payStatus === 'Paid';
  const receipts = (o.receipts?.length ?? 0) + (sent ? 1 : 0);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr('');
    const e = await uploadReceipt(o.id, o.email, f);
    setBusy(false);
    if (e) return setErr(e);
    setSent(true);
  };

  if (paid) return <div className="card" style={{ marginBottom: 24, borderColor: '#86EFAC', background: '#F0FDF4' }}><b>Payment received.</b> Thank you, we are preparing your order.</div>;
  if (!bank) {
    return wa ? (
      <div className="card row-between" style={{ marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div><b>{o.pay}</b><div className="muted">We will confirm everything with you. You can also message us directly.</div></div>
        <a className="btn" href={wa} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
      </div>
    ) : null;
  }

  return (
    <div className="card stack" style={{ marginBottom: 24, gap: 14, borderColor: 'var(--brown)' }}>
      <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="h3">Complete your payment · {money(o.due ?? o.total)}</div>
        <span className="tag" style={{ background: receipts ? '#DBEAFE' : '#FEF3C7', color: receipts ? '#1E40AF' : '#8A4B00' }}>{receipts ? t('Receipt received, awaiting approval') : t('Waiting for your payment')}</span>
      </div>
      <BankAccounts accounts={st.banks} reference={o.id} value={st.banks.find((b) => b.bank === o.payBank)?.id} />
      <div style={{ fontSize: 14, color: 'var(--text2)' }}>After paying, send us the receipt so we can approve your order. Either way works:</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {remote && (
          <>
            <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn" disabled={busy || receipts >= 3} onClick={() => file.current?.click()}>{busy ? t('Uploading…') : t('Upload receipt photo')}</button>
          </>
        )}
        {wa && <a className="btn ghost" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
      </div>
      {sent && <div className="ok">Receipt uploaded. We will check it and approve your payment soon.</div>}
      <ErrorText>{err}</ErrorText>
      <div className="muted" style={{ fontSize: 12 }}>On WhatsApp, include your order number {o.id} and a photo of the receipt.</div>
    </div>
  );
}
