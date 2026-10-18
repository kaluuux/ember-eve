import { useState } from 'react';
import { useApp } from '../AppContext';
import { remote } from '../remote';
import { money } from '../store';
import { ErrorText } from '../components/ui';
import { go } from '../router';
import { useT } from '../i18n';

const PRESETS = [2000, 5000, 10000];

/** Sell a gift card: a code the recipient spends at checkout. Delivered on the order page once payment is approved. */
export function GiftCards() {
  const { settings: st, addLine, flash } = useApp();
  const t = useT();
  const [amount, setAmount] = useState(PRESETS[0]);
  const [custom, setCustom] = useState('');
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const value = custom.trim() ? Math.round(Number(custom)) : amount;

  if (!remote || !st.giftCardsOn) {
    return (
      <section className="page-72">
        <h1 className="h1">{t('Gift cards')}</h1>
        <p className="muted">{t('Gift cards are not available just yet. Please check back soon, or build a gift box instead.')}</p>
        <a href="/gifts" className="btn">{t('Build a gift box')}</a>
      </section>
    );
  }

  const add = () => {
    if (!(value >= st.giftCardMin && value <= st.giftCardMax)) return setErr(t('Choose an amount between {min} and {max}.', { min: money(st.giftCardMin), max: money(st.giftCardMax) }));
    setErr('');
    addLine({
      key: 'gc-' + Date.now(), pid: 0, kind: 'giftcard', name: t('Gift card'), sub: t('For {name}', { name: to.trim() || t('a friend') }), unit: value, tint: '#E9D5B5', qty: 1,
      gc: { to: to.trim(), from: from.trim(), msg: msg.trim() },
    });
    flash(t('Gift card added to your basket'));
    go('cart');
  };

  return (
    <section className="page-72">
      <h1 className="h1">{t('Gift cards')}</h1>
      <p className="muted" style={{ maxWidth: 560 }}>{t('Not sure which scent or colour? Give candlelight and let them choose. We create a code once your payment is approved. It shows on your order page, ready to pass on by WhatsApp.')}</p>
      <div className="card stack" style={{ gap: 16, maxWidth: 560 }}>
        <div>
          <div className="label-s">{t('Amount')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.filter((p) => p >= st.giftCardMin && p <= st.giftCardMax).map((p) => (
              <button key={p} type="button" className={'chip lg' + (!custom.trim() && amount === p ? ' on' : '')} onClick={() => { setAmount(p); setCustom(''); }}>{money(p)}</button>
            ))}
            <input className="input" style={{ width: 150 }} type="number" min={st.giftCardMin} max={st.giftCardMax} placeholder={t('Other amount')} aria-label={t('Other amount')} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </div>
        </div>
        <div className="fields two">
          <label className="field">{t('For')}<input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('Their name')} maxLength={60} /></label>
          <label className="field">{t('From')}<input className="input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t('Your name')} maxLength={60} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>{t('Message (optional)')}<textarea className="input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} /></label>
        </div>
        <ErrorText>{err}</ErrorText>
        <div><button type="button" className="btn" onClick={add}>{t('Add to basket')} · {money(value || 0)}</button></div>
        <div className="muted" style={{ fontSize: 13 }}>{t('Gift cards can be used on any candle, in one go or over several orders. They cannot be used to buy another gift card.')}</div>
      </div>
    </section>
  );
}
