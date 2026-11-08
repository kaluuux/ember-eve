import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, useForm } from '../components/ui';
import { get, isEmail, set } from '../store';
import { remote } from '../remote';
import { sendMessage } from '../sync';
import type { Message } from '../types';

export const OCCASIONS = ['Corporate gifts', 'Wedding favours', 'Events and parties', 'Hotel, spa or restaurant', 'Retail or resale', 'Festive season gifts', 'Something else'];
const PERKS: [string, string][] = [
  ['Custom colours', 'Match your brand or wedding palette, with any of our colours or a custom blend.'],
  ['Personal touches', 'A sticker message on glass and jar candles, and gift boxes with a note for each person.'],
  ['Made to order', 'Hand-poured in small batches in Sri Lanka, with a delivery date we agree up front.'],
  ['Island-wide delivery', 'One parcel or many, delivered to your office, venue or each guest.'],
];

/** Corporate and bulk orders: an enquiry form that lands in the admin Messages as a "Bulk order enquiry". */
export function Bulk() {
  const { settings } = useApp();
  const { bind, str, setF, set: patch } = useForm({ occasion: OCCASIONS[0] });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (str('website')) return setDone(true); // honeypot: bots fill the hidden field
    if (!str('name').trim()) return setErr('Enter your name.');
    if (!isEmail(str('email'))) return setErr('Enter a valid email address.');
    if (!/^[+\d][\d\s-]{8,}$/.test(str('phone').trim())) return setErr('Enter a phone or WhatsApp number so we can reach you.');
    const qty = Math.round(Number(str('qty')));
    if (!(qty >= 1)) return setErr('Enter roughly how many candles you need.');
    const need = str('needBy') ? ' · needed by ' + str('needBy') : '';
    const text = 'Bulk order enquiry: ' + qty + ' candles for ' + str('occasion').toLowerCase() + need + (str('company').trim() ? ' (' + str('company').trim() + ')' : '') + '.' + (str('details').trim() ? '\n' + str('details').trim() : '');
    const msg: Omit<Message, 'id' | 'read'> = {
      name: str('name').trim(), email: str('email').trim(), text: text.slice(0, 1800), date: new Date().toISOString(),
      kind: 'bulk', company: str('company').trim().slice(0, 120), phone: str('phone').trim().slice(0, 30), occasion: str('occasion'), qty, needBy: str('needBy'),
    };
    setBusy(true);
    try {
      if (remote) await sendMessage(msg);
      else set<Message[]>('messages', get<Message[]>('messages', []).concat({ id: Date.now(), ...msg, read: false }));
    } catch {
      setBusy(false);
      return setErr('Could not send your enquiry. Please try again, or message us on WhatsApp.');
    }
    setBusy(false); setErr(''); setDone(true); setF({ occasion: OCCASIONS[0] });
  };

  return (
    <section className="page">
      <div className="crumb"><a href="/">Home</a> / Corporate and bulk orders</div>
      <h1 className="h1" style={{ margin: '8px 0 8px' }}>Corporate and bulk candle orders in Sri Lanka</h1>
      <p className="muted" style={{ margin: '0 0 24px', maxWidth: 680, fontSize: 16, lineHeight: '26px' }}>
        Handmade soy wax candles for company gifts, wedding favours, events, hotels, spas and shops. Tell us what you need and we will reply within 2 working days with options and a quote.
      </p>
      <div className="layout-half" style={{ gap: 24, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 12 }}>
          {PERKS.map(([h, d]) => (
            <div key={h} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{h}</div>
              <div className="muted" style={{ fontSize: 14, lineHeight: '22px' }}>{d}</div>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 13 }}>
            Prefer to chat? {settings.whatsapp ? <><a href={'https://wa.me/' + settings.whatsapp} target="_blank" rel="noreferrer">Message us on WhatsApp</a>{settings.email ? ' or ' : '.'}</> : null}
            {settings.email ? <a href={'mailto:' + settings.email}>email {settings.email}</a> : null}
          </div>
        </div>

        {done ? (
          <div className="card stack" style={{ gap: 12 }} role="status">
            <div className="h3">Thank you, we have your enquiry</div>
            <p style={{ margin: 0 }}>We will reply within 2 working days with options and a quote. Meanwhile you can browse our candles or read about colours and care.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/shop" className="btn">Shop candles</a>
              <button type="button" className="btn ghost" onClick={() => setDone(false)}>Send another enquiry</button>
            </div>
          </div>
        ) : (
          <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
            <div className="h3">Request a quote</div>
            <div className="fields two">
              <Field label="Your name" {...bind('name')} autoComplete="name" />
              <Field label="Company or event (optional)" {...bind('company')} autoComplete="organization" />
              <Field label="Email" type="email" {...bind('email')} autoComplete="email" />
              <Field label="Phone / WhatsApp" type="tel" {...bind('phone')} autoComplete="tel" />
              <label className="field">What is it for?
                <select className="input" name="occasion" value={str('occasion')} onChange={(e) => patch({ occasion: e.target.value })}>
                  {OCCASIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <Field label="Roughly how many candles?" type="number" {...bind('qty')} />
              <label className="field span2">Needed by (optional)
                <input className="input" type="date" name="needBy" value={str('needBy')} min={new Date().toISOString().slice(0, 10)} onChange={(e) => patch({ needBy: e.target.value })} />
              </label>
              <Field label="Tell us more: colours, sizes, logo or message, budget (optional)" {...bind('details')} rows={5} span={2} />
              <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
                <label>Website<input name="website" tabIndex={-1} autoComplete="off" value={str('website')} onChange={(e) => patch({ website: e.target.value })} /></label>
              </div>
            </div>
            <ErrorText>{err}</ErrorText>
            <div><button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send enquiry'}</button></div>
          </form>
        )}
      </div>
    </section>
  );
}
