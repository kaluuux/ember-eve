import { useEffect } from 'react';
import { useApp } from '../AppContext';
import { BankAccounts } from '../components/BankAccounts';
import { lineText } from '../commerce';
import { EMPTY, fmtDate, get, money, useStored } from '../store';
import { remote } from '../remote';
import { useIsAdmin } from '../sync';
import type { Route } from '../router';
import type { Order, PayMethod } from '../types';

const PAY_LABEL: Record<PayMethod, string> = { bank: 'Bank transfer / LankaQR', card: 'Card', store: 'Pay at store pickup', whatsapp: 'Arranged on WhatsApp' };

/** A printable invoice in the shop's look. The customer sees their own orders; admins see any order. */
export function Invoice({ route }: { route: Route }) {
  const { user, settings: st } = useApp();
  const orders = useStored<Order[]>('orders', EMPTY);
  const admin = useIsAdmin() || (!remote && !!get('admin', null));
  const o = orders.find((x) => x.id === route.arg);
  const mine = get<string[]>('myorders', []);
  const allowed = !!o && (admin || (!!user && (o.userId === user.id || o.email === user.email)) || mine.includes(o.id));

  useEffect(() => { document.title = o ? 'Invoice ' + o.id + ' · ' + st.shop : st.shop; return () => { document.title = st.shop; }; }, [o, st.shop]);
  useEffect(() => { if (route.q.print && allowed) window.setTimeout(() => window.print(), 400); }, [route.q.print, allowed]);

  if (!o || !allowed) {
    return (
      <div className="inv-wrap">
        <div className="inv-paper" style={{ textAlign: 'center' }}>
          <h1 className="inv-title">Invoice not found</h1>
          <p>Open it from your order page, or sign in first.</p>
          <a href="#/track" className="btn">Track an order</a>
        </div>
      </div>
    );
  }

  const paid = (o.payStatus ?? 'Paid') === 'Paid';
  const num = 'INV-' + o.id.replace(/\D/g, '');
  const pickup = o.shipM === 'pickup';
  const addr = [o.address.a1, o.address.a2, o.address.city, o.address.district, o.address.post].filter(Boolean);
  const bank = o.payMethod === 'bank' && !paid ? st.banks.filter((b) => b.number.trim()).find((b) => b.bank === o.payBank) ?? st.banks.find((b) => b.number.trim()) : undefined;
  const status = paid ? 'PAID' : o.payStatus === 'Receipt sent' ? 'RECEIPT RECEIVED' : o.payStatus === 'Failed' ? 'PAYMENT REJECTED' : 'PAYMENT DUE';
  const stamp = paid ? 'paid' : o.payStatus === 'Receipt sent' ? 'review' : 'due';

  return (
    <div className="inv-wrap">
      <div className="inv-bar no-print">
        <a href={route.q.back ? '#/' + route.q.back : '#/order/' + o.id} className="btn ghost sm">← Back</a>
        <button type="button" className="btn sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <article className="inv-paper" aria-label={'Invoice ' + num}>
        <header className="inv-head">
          <div className="inv-brand">
            <img src="/logo.png" alt="" width={64} height={64} />
            <div>
              <div className="inv-shop">{st.shop}</div>
              <div className="inv-tag">Hand-poured soy wax candles</div>
            </div>
          </div>
          <div className="inv-meta">
            <h1 className="inv-title">Invoice</h1>
            <dl>
              <div><dt>Invoice no.</dt><dd>{num}</dd></div>
              <div><dt>Order no.</dt><dd>{o.id}</dd></div>
              <div><dt>Date</dt><dd>{fmtDate(o.date)}</dd></div>
            </dl>
          </div>
        </header>

        <div className="inv-grid">
          <section>
            <h2>From</h2>
            <b>{st.shop}</b>
            {st.businessAddress && <div>{st.businessAddress}</div>}
            {st.businessPhone && <div>{st.businessPhone}</div>}
            {st.whatsapp && <div>WhatsApp +{st.whatsapp}</div>}
            {st.email && <div>{st.email}</div>}
            {st.taxId && <div className="muted">Reg. / tax no. {st.taxId}</div>}
          </section>
          <section>
            <h2>Billed to</h2>
            <b>{o.name}</b>
            <div>{o.email}</div>
            {o.phone && <div>{o.phone}</div>}
            {!pickup && addr.length > 0 && <div>{addr.join(', ')}</div>}
          </section>
          <section>
            <h2>{pickup ? 'Collection' : 'Delivery'}</h2>
            <b>{pickup ? 'Store pickup' : o.shipM === 'express' ? 'Express delivery' : 'Standard delivery'}</b>
            {pickup && st.pickupAddress && <div>{st.pickupAddress}</div>}
            {!pickup && addr.length > 0 && <div>To the billing address</div>}
            {o.tracking?.number && <div>{o.tracking.courier} · {o.tracking.number}</div>}
          </section>
        </div>

        <div className={'inv-status ' + stamp}>{status}</div>

        <table className="inv-table">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {o.items.map((l, i) => (
              <tr key={i}>
                <td><b>{l.name}</b><div className="inv-sub">{lineText(l)}</div></td>
                <td className="num">{l.qty}</td>
                <td className="num">{money(l.unit)}</td>
                <td className="num">{money(l.unit * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-bottom">
          <div className="inv-pay">
            <h2>Payment</h2>
            <div><b>{o.payMethod ? PAY_LABEL[o.payMethod] : o.pay}</b>{o.payBank ? ' · ' + o.payBank : ''}</div>
            <div className="muted">Status: {paid ? 'Paid in full' : o.payStatus === 'Receipt sent' ? 'Receipt received, awaiting approval' : o.payStatus === 'Failed' ? 'Receipt not accepted, please contact us' : 'Awaiting payment'}</div>
            {bank && (
              <div className="inv-bank">
                <BankAccounts accounts={[bank]} reference={o.id} />
              </div>
            )}
          </div>
          <dl className="inv-totals">
            <div><dt>Subtotal</dt><dd>{money(o.sub)}</dd></div>
            {o.disc > 0 && <div><dt>Discount{o.code ? ' (' + o.code + ')' : ''}</dt><dd>-{money(o.disc)}</dd></div>}
            <div><dt>{pickup ? 'Store pickup' : 'Delivery'}</dt><dd>{o.ship === 0 ? 'Free' : money(o.ship)}</dd></div>
            {o.wrap > 0 && <div><dt>Gift wrap</dt><dd>{money(o.wrap)}</dd></div>}
            <div className="grand"><dt>Total</dt><dd>{money(o.total)}</dd></div>
            <div className={'due ' + (paid ? 'ok' : 'owing')}><dt>{paid ? 'Amount paid' : 'Amount due'}</dt><dd>{paid ? money(o.total) : money(o.total)}</dd></div>
          </dl>
        </div>

        {(o.sellerNote || o.note) && (
          <div className="inv-notes">
            {o.sellerNote && <div><h2>Customer note</h2>{o.sellerNote}</div>}
            {o.note && <div><h2>Gift message</h2>{o.note}</div>}
          </div>
        )}

        <footer className="inv-foot">
          <div>{st.invoiceNote || 'Thank you for choosing ' + st.shop + '. Every candle is poured by hand with care.'}</div>
          <div className="muted">Questions about this invoice? {st.email}{st.whatsapp ? ' · WhatsApp +' + st.whatsapp : ''}</div>
        </footer>
      </article>
    </div>
  );
}
