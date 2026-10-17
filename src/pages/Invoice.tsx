import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { lineText } from '../commerce';
import { EMPTY, get, useStored } from '../store';
import { remote } from '../remote';
import { useIsAdmin } from '../sync';
import type { Route } from '../router';
import type { Order, PayMethod } from '../types';

const PAY_LABEL: Record<PayMethod, string> = { bank: 'Bank transfer / LankaQR', card: 'Card', store: 'Pay at store pickup', whatsapp: 'Arranged on WhatsApp' };
const rs = (n: number) => 'Rs.' + Math.round(n).toLocaleString('en-LK') + '/-';
const num = (n: number) => Math.round(n).toLocaleString('en-LK');
const dmy = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * A printable invoice. Drop your own artwork into public/ as invoice-logo.png (candle mark, top right)
 * and invoice-wordmark.png (name and tagline, bottom right); without them the shop logo and a text wordmark are used.
 */
export function Invoice({ route }: { route: Route }) {
  const { user, settings: st } = useApp();
  const orders = useStored<Order[]>('orders', EMPTY);
  const admin = useIsAdmin() || (!remote && !!get('admin', null));
  const [noMark, setNoMark] = useState(false);
  const [noWord, setNoWord] = useState(false);
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
  const pickup = o.shipM === 'pickup';
  const date = new Date(o.date);
  const due = new Date(date.getTime() + (st.invoiceDueDays ?? 10) * 86400000);
  const addr = [o.address.a1, o.address.a2, o.address.city, o.address.district, o.address.post].filter(Boolean).join(', ');
  const stamp = paid ? 'paid' : o.payStatus === 'Receipt sent' ? 'review' : 'due';
  const stampText = paid ? 'PAID' : o.payStatus === 'Receipt sent' ? 'RECEIPT RECEIVED' : o.payStatus === 'Failed' ? 'PAYMENT REJECTED' : 'PAYMENT DUE';
  const method = (o.payMethod ? PAY_LABEL[o.payMethod] : o.pay) + (o.payBank ? ' · ' + o.payBank : '');
  const contact = [st.businessAddress, st.businessPhone, st.whatsapp && 'WhatsApp +' + st.whatsapp, st.email, st.taxId && 'Reg. no. ' + st.taxId].filter(Boolean).join('  ·  ');

  return (
    <div className="inv-wrap">
      <div className="inv-bar no-print">
        <a href={route.q.back ? '#/' + route.q.back : '#/order/' + o.id} className="btn ghost sm">← Back</a>
        <button type="button" className="btn sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <article className="inv-paper" aria-label={'Invoice ' + o.id}>
        <header className="inv-head">
          <div>
            <h1 className="inv-title">INVOICE</h1>
            <div className="inv-shop">{st.shop}</div>
            <div className="inv-tag">Light up your little moments <span aria-hidden="true">🕯️</span></div>
          </div>
          <img className="inv-mark" src={noMark ? '/logo.png' : '/invoice-logo.png'} onError={() => setNoMark(true)} alt={st.shop} />
        </header>

        <div className="inv-info">
          <dl>
            <div><dt>Invoice Number:</dt><dd>{o.id}</dd></div>
            <div><dt>Customer Name</dt><dd>{o.name}</dd></div>
            <div><dt>Contact Number:</dt><dd>{o.phone || o.email}</dd></div>
            <div><dt>{pickup ? 'Collection' : 'Delivery Address'}:</dt><dd>{pickup ? 'Store pickup' + (st.pickupAddress ? ' · ' + st.pickupAddress : '') : addr}</dd></div>
          </dl>
          <dl className="right">
            <div><dt>Invoice Date:</dt><dd>{dmy(date)}</dd></div>
            {!paid && <div><dt>Due Date:</dt><dd>{dmy(due)}</dd></div>}
            <div><dt>Delivery:</dt><dd>{pickup ? 'Store pickup' : o.shipM === 'express' ? 'Express' : 'Standard'}</dd></div>
            {o.tracking?.number && <div><dt>Tracking:</dt><dd>{o.tracking.courier} {o.tracking.number}</dd></div>}
          </dl>
        </div>

        <table className="inv-table">
          <thead><tr><th>Item</th><th className="c">Qty</th><th className="c">Price</th><th className="c">Amount</th></tr></thead>
          <tbody>
            {o.items.map((l, i) => (
              <tr key={i}>
                <td>{l.name}<div className="inv-sub">{lineText(l)}</div></td>
                <td className="c">{l.qty}</td>
                <td className="c">{num(l.unit)}</td>
                <td className="c">{num(l.unit * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="inv-totals">
          <div><dt>Subtotal:</dt><dd>{rs(o.sub)}</dd></div>
          {o.disc > 0 && <div><dt>Discount{o.code ? ' (' + o.code + ')' : ''}:</dt><dd>{rs(o.disc)}</dd></div>}
          <div><dt>{pickup ? 'Pickup' : 'Delivery Fee'}:</dt><dd>{o.ship === 0 ? 'Rs. 0' : rs(o.ship)}</dd></div>
          {o.wrap > 0 && <div><dt>Gift Wrap:</dt><dd>{rs(o.wrap)}</dd></div>}
          <div className="grand"><dt>{paid ? 'TOTAL PAID' : 'TOTAL DUE'}:</dt><dd>{rs(o.total)}</dd></div>
        </dl>

        <div className="inv-pay">
          <div className={'inv-status ' + stamp}>{stampText}</div>
          <div className="inv-method">Payment method: {method}</div>
        </div>

        {(o.sellerNote || o.note) && (
          <div className="inv-notes">
            {o.sellerNote && <div><b>Customer note:</b> {o.sellerNote}</div>}
            {o.note && <div><b>Gift message:</b> {o.note}</div>}
          </div>
        )}

        {!paid && <p className="inv-confirm">{st.invoiceNote || 'Please confirm the order details and delivery information before payment'}</p>}

        <footer className="inv-foot">
          <div className="inv-thanks">Thank you for choosing<br />{st.shop}!</div>
          {noWord ? (
            <div className="inv-word"><div>{st.shop}</div><small>LIGHT UP YOUR LITTLE MOMENTS</small></div>
          ) : (
            <img className="inv-wordimg" src="/invoice-wordmark.png" onError={() => setNoWord(true)} alt={st.shop} />
          )}
        </footer>
        {contact && <div className="inv-contact">{contact}</div>}
      </article>
    </div>
  );
}
