import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, useForm } from '../components/ui';
import { EMPTY, fmtDate, get, useStored } from '../store';
import { remote } from '../remote';
import { trackOrder, type TrackResult } from '../sync';
import type { Order, OrderStatus } from '../types';
import type { Route } from '../router';

const STAGES = ['Order placed', 'Preparing', 'Dispatched', 'Delivered'];
const RANK: Record<OrderStatus, number> = { Cancelled: -1, Processing: 1, Dispatched: 2, Delivered: 3 };
const last9 = (s: string) => s.replace(/\D/g, '').slice(-9);

/** Offline demo: the same lookup the server does, against this browser's orders. */
function localLookup(orders: Order[], q: string, phone: string): TrackResult | null {
  const key = q.trim().toLowerCase(), digits = key.replace(/\D/g, '');
  const o = orders.find((x) => last9(x.phone) === last9(phone) && last9(phone).length === 9 && (x.id.toLowerCase() === key || (/^\d+$/.test(key) && x.id === 'EE-' + digits) || x.tracking?.number.toLowerCase() === key));
  if (!o) return null;
  return {
    id: o.id, date: o.date, status: o.status, payStatus: o.payStatus ?? 'Paid', payMethod: o.payMethod, shipM: o.shipM, tracking: o.tracking ?? null, log: o.log ?? [],
    city: o.address.city, district: o.address.district, first: o.first, items: o.items.map((i) => ({ name: i.name, qty: i.qty, tint: i.tint })),
  };
}

/** One place for anyone to follow an order: a mobile number plus the order number or courier tracking number. */
export function Track({ route }: { route: Route }) {
  const { settings: st } = useApp();
  const orders = useStored<Order[]>('orders', EMPTY);
  const { bind, str } = useForm({ tkid: route.q.o ?? '', tkphone: route.q.p ?? '' });
  const [err, setErr] = useState('');
  const [res, setRes] = useState<TrackResult | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (last9(str('tkphone')).length < 9) { setRes(null); return setErr('Enter the mobile number you used when ordering.'); }
    if (!str('tkid').trim()) { setRes(null); return setErr('Enter your order number or the courier tracking number.'); }
    setBusy(true); setErr('');
    let found: TrackResult | null = null;
    if (remote) {
      const r = await trackOrder(str('tkid'), str('tkphone'));
      if (r.error) { setBusy(false); setRes(null); return setErr(r.error); }
      found = r.result;
    } else {
      found = localLookup(orders.length ? orders : get<Order[]>('orders', []), str('tkid'), str('tkphone'));
    }
    setBusy(false);
    setRes(found);
    if (!found) setErr('We could not find an order with those details. Check the number, the mobile number on the order, and try again.');
  };

  const mine = res ? get<string[]>('myorders', []).includes(res.id) : false;
  const rank = res ? RANK[res.status] : 0;
  const cancelled = res?.status === 'Cancelled';
  const when = (s: string) => { const g = res?.log.find((x) => x.s === s); return g ? fmtDate(g.d, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
  const wa = st.whatsapp && res ? 'https://wa.me/' + st.whatsapp + '?text=' + encodeURIComponent('Hi, I have a question about order ' + res.id + '.') : '';

  return (
    <section className="narrow" style={{ maxWidth: 640 }}>
      <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        <div>
          <h1 className="h1">Track Your Order</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>No account needed. Enter the mobile number you ordered with, and your order number or courier tracking number.</p>
        </div>
        <div className="fields one">
          <Field label="Mobile number" type="tel" {...bind('tkphone')} placeholder="077 123 4567" autoComplete="tel" />
          <Field label="Order number or tracking number" {...bind('tkid')} placeholder="EE-1004 or courier tracking number" />
        </div>
        <ErrorText>{err}</ErrorText>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Looking…' : 'Track Order'}</button>
      </form>

      {res && (
        <div className="card stack" style={{ gap: 18, marginTop: 20 }} aria-live="polite">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div className="h3">Order {res.id}</div>
              <div className="muted">Placed {fmtDate(res.date)}{res.first ? ' · ' + res.first : ''}</div>
            </div>
            <span className="tag" style={{ fontSize: 14, background: cancelled ? '#FEE2E2' : rank === 3 ? '#DCFCE7' : rank === 2 ? '#DBEAFE' : '#FEF3C7', color: cancelled ? '#991B1B' : rank === 3 ? '#166534' : rank === 2 ? '#1E40AF' : '#8A4B00' }}>{res.status === 'Processing' ? 'Preparing' : res.status}</span>
          </div>

          {cancelled ? (
            <div className="notice-warn">This order was cancelled. If you did not expect this, please contact us.</div>
          ) : (
            <ol className="track-steps">
              {STAGES.map((l, i) => {
                const done = i === 0 || rank >= i;
                const stamp = i === 0 ? when('Placed') : i === 2 ? when('Dispatched') : i === 3 ? when('Delivered') : rank >= 1 ? '' : '';
                return (
                  <li key={l} className={done ? 'done' : ''}>
                    <span className="dot-s" aria-hidden="true">{done ? '✓' : ''}</span>
                    <div><b>{l}</b>{stamp && <div className="muted" style={{ fontSize: 12 }}>{stamp}</div>}</div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="track-info">
            <div>
              <div className="label-s">Payment</div>
              {res.payStatus === 'Paid' ? 'Paid' : res.payStatus === 'Receipt sent' ? 'Receipt received, we are checking it' : res.payStatus === 'Failed' ? 'There was a problem with your payment, please contact us' : 'Waiting for your payment, send us your receipt'}
            </div>
            <div>
              <div className="label-s">{res.shipM === 'pickup' ? 'Collection' : 'Delivery'}</div>
              {res.shipM === 'pickup' ? 'Store pickup' + (st.pickupAddress ? ': ' + st.pickupAddress : '') : [res.city, res.district].filter(Boolean).join(', ') || 'Standard delivery'}
            </div>
            <div>
              <div className="label-s">Courier tracking</div>
              {res.tracking?.number ? <>{res.tracking.courier} · <b>{res.tracking.number}</b>{res.tracking.url && <> · <a href={res.tracking.url} target="_blank" rel="noreferrer">Track parcel</a></>}</> : res.shipM === 'pickup' ? 'Not needed for pickup' : 'Added here once your order is dispatched'}
            </div>
          </div>

          <div>
            <div className="label-s">Items</div>
            {res.items.map((i, k) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 14 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: i.tint, border: '1px solid var(--line)', flex: 'none' }} />{i.qty} × {i.name}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {mine && <a className="btn ghost sm" href={'#/order/' + res.id}>Open full order</a>}
            {wa && <a className="btn ghost sm" href={wa} target="_blank" rel="noreferrer">Ask us on WhatsApp</a>}
          </div>
        </div>
      )}
    </section>
  );
}
