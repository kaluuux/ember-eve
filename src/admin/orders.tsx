import { useEffect, useMemo, useState } from 'react';
import { EMPTY, fmtDate, get, money, set, useStored, withDefaults, DEFAULT_SETTINGS } from '../store';
import { go } from '../router';
import { remote } from '../remote';
import { receiptLinks } from '../sync';
import { lineText, orderView } from '../commerce';
import { PageHead, PayBadge, StatusBadge, downloadCsv, payOf, waLink } from './ui';
import type { Order, OrderStatus, Product, Settings } from '../types';

type Flash = (m: string) => void;
const STATUS_FILTERS = ['All', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'] as const;
type PayFilter = 'all' | 'review' | 'waiting' | 'paid';
const PAY_FILTERS: [PayFilter, string][] = [['all', 'Any payment'], ['review', 'Receipt to check'], ['waiting', 'Awaiting payment'], ['paid', 'Paid']];
const COURIERS = ['Domex', 'Pronto', 'Koombiyo', 'Prompt Xpress', 'Speed Express', 'Sri Lanka Post', 'Other'];

const matchPay = (o: Order, f: PayFilter) => f === 'all' || (f === 'review' && payOf(o) === 'Receipt sent') || (f === 'waiting' && (payOf(o) === 'Pending' || payOf(o) === 'Failed')) || (f === 'paid' && payOf(o) === 'Paid');

export function OrdersView({ sel, pay, status, flash }: { sel: string; pay: string; status: string; flash: Flash }) {
  const orders = useStored<Order[]>('orders', EMPTY);
  const settings = withDefaults(useStored<Settings>('settings', DEFAULT_SETTINGS));
  const [fil, setFil] = useState<string>(STATUS_FILTERS.includes(status as never) ? status : 'All');
  const [payFil, setPayFil] = useState<PayFilter>(PAY_FILTERS.some(([k]) => k === pay) ? (pay as PayFilter) : 'all');
  const [search, setSearch] = useState('');
  useEffect(() => { if (status) setFil(status); if (pay) setPayFil(pay as PayFilter); }, [status, pay]);

  const q = search.toLowerCase();
  const rows = useMemo(
    () => orders.slice().sort((a, b) => b.date.localeCompare(a.date)).filter((o) => (fil === 'All' || o.status === fil) && matchPay(o, payFil) && (!q || (o.id + o.name + o.email + o.phone).toLowerCase().includes(q))),
    [orders, fil, payFil, q],
  );
  const count = (f: string) => orders.filter((o) => f === 'All' || o.status === f).length;
  const payCount = (f: PayFilter) => orders.filter((o) => o.status !== 'Cancelled' && matchPay(o, f)).length;
  const selO = orders.find((o) => o.id === sel);

  const exportCsv = () => {
    const head = ['Order', 'Date', 'Status', 'Payment status', 'Payment method', 'Paid to bank', 'Customer', 'Email', 'Phone', 'Delivery', 'Address', 'District', 'Items', 'Subtotal', 'Discount', 'Code', 'Delivery fee', 'Gift wrap', 'Total', 'Courier', 'Tracking', 'Customer note', 'Gift message'];
    const body = rows.map((o) => [o.id, o.date.slice(0, 10), o.status, payOf(o), o.pay, o.payBank ?? '', o.name, o.email, o.phone, o.shipM, [o.address.a1, o.address.a2, o.address.city, o.address.post].filter(Boolean).join(', '), o.address.district ?? '', o.items.map((i) => i.qty + ' x ' + i.name + ' (' + lineText(i) + ')').join(' | '), o.sub, o.disc, o.code, o.ship, o.wrap, o.total, o.tracking?.courier ?? '', o.tracking?.number ?? '', o.sellerNote ?? '', o.note]);
    downloadCsv('orders', [head, ...body]);
  };

  return (
    <>
      <PageHead title="Orders" sub={rows.length + ' of ' + orders.length + ' orders shown'} actions={<button type="button" className="btn ghost sm" onClick={exportCsv}>Export CSV</button>} />
      <div className="filters">
        {STATUS_FILTERS.map((c) => <button key={c} type="button" className={'chip' + (fil === c ? ' on' : '')} onClick={() => setFil(c)}>{c}<small>{count(c)}</small></button>)}
        <span className="sep" />
        {PAY_FILTERS.map(([k, l]) => <button key={k} type="button" className={'chip' + (payFil === k ? ' on' : '')} onClick={() => setPayFil(k)}>{l}{k !== 'all' && <small>{payCount(k)}</small>}</button>)}
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, name, email, phone" aria-label="Search orders" style={{ width: 280, marginLeft: 'auto' }} />
      </div>

      <div className={'orders-layout' + (selO ? ' open' : '')}>
        <div className="card flush" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th style={{ textAlign: 'right' }}>Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={'click' + (sel === o.id ? ' sel' : '')} onClick={() => go('admin/orders?sel=' + o.id)}>
                  <td style={{ fontWeight: 600 }}>{o.id}</td>
                  <td>{fmtDate(o.date, { day: 'numeric', month: 'short' })}</td>
                  <td>{o.name}<div className="muted" style={{ fontSize: 12 }}>{o.phone || o.email}</div></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(o.total)}</td>
                  <td><PayBadge o={o} /></td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty">No orders match these filters.</div>}
        </div>
        {selO && <OrderDetail key={selO.id} o={selO} settings={settings} flash={flash} />}
      </div>
    </>
  );
}

function OrderDetail({ o, settings, flash }: { o: Order; settings: Settings; flash: Flash }) {
  const v = orderView(o);
  const [links, setLinks] = useState<{ path: string; url: string }[]>([]);
  const [courier, setCourier] = useState(o.tracking?.courier || 'Domex');
  const [num, setNum] = useState(o.tracking?.number ?? '');
  const [url, setUrl] = useState(o.tracking?.url ?? '');
  const receipts = o.receipts ?? [];
  useEffect(() => { if (remote && receipts.length) void receiptLinks(receipts).then(setLinks); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [receipts.join('|')]);

  /** Change one order and write it through (the server only receives the fields that changed). */
  const update = (fn: (x: Order) => void, msg: string) => {
    const list = get<Order[]>('orders', []).map((x) => JSON.parse(JSON.stringify(x)) as Order);
    const x = list.find((y) => y.id === o.id);
    if (!x) return;
    fn(x);
    set('orders', list);
    flash(msg);
  };
  const log = (x: Order, s: string) => { x.log = (x.log || []).concat({ s, d: new Date().toISOString() }); };

  const setStatus = (st: OrderStatus) => {
    if (st === 'Cancelled') {
      const products = get<Product[]>('products', []).map((p) => ({ ...p }));
      o.items.forEach((i) => {
        const back = i.pid ? [{ pid: i.pid }] : i.box ?? [];
        back.forEach((b) => { const p = products.find((y) => y.id === b.pid); if (p && p.stock !== null) p.stock += i.qty; });
      });
      set('products', products);
    }
    update((x) => { x.status = st; log(x, st); }, 'Order ' + o.id + ': ' + st);
  };
  const approve = () => update((x) => { x.payStatus = 'Paid'; log(x, 'Payment approved'); }, 'Payment approved for ' + o.id);
  const reject = () => update((x) => { x.payStatus = 'Failed'; log(x, 'Payment rejected'); }, 'Payment marked as rejected');
  const reopen = () => update((x) => { x.payStatus = 'Pending'; log(x, 'Payment reopened'); }, 'Payment reopened');
  const saveTracking = () => update((x) => { x.tracking = { courier, number: num.trim(), url: url.trim() }; log(x, 'Tracking added'); }, 'Tracking saved');

  const next = ({ Processing: 'Dispatched', Dispatched: 'Delivered' } as Partial<Record<OrderStatus, OrderStatus>>)[o.status];
  const canCancel = o.status === 'Processing' || o.status === 'Dispatched';
  const pay = payOf(o);
  const hello = 'Hi ' + (o.first || o.name.split(' ')[0]) + ', this is ' + settings.shop + ' about your order ' + o.id + '. ';

  return (
    <aside className="panel detail" aria-label={'Order ' + o.id}>
      <div className="row-between">
        <div>
          <div className="h3" style={{ fontSize: 20 }}>{o.id}</div>
          <div className="muted" style={{ fontSize: 12 }}>{new Date(o.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <button type="button" className="btn-xs" onClick={() => go('admin/orders')}>Close</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatusBadge status={o.status} /><PayBadge o={o} /></div>

      <div className="block">
        <h4>Customer</h4>
        <b>{o.name}</b><br />{o.email}<br />{o.phone}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {o.phone && <a className="btn-xs" href={waLink(o.phone, hello)} target="_blank" rel="noreferrer">WhatsApp customer</a>}
          {o.phone && <a className="btn-xs" href={'tel:' + o.phone}>Call</a>}
          <a className="btn-xs" href={'#/invoice/' + o.id + '?back=admin/orders%3Fsel%3D' + o.id} target="_blank" rel="noreferrer">Invoice</a>
          <a className="btn-xs" href={'mailto:' + o.email + '?subject=' + encodeURIComponent('Your order ' + o.id)}>Email</a>
        </div>
      </div>

      <div className="block">
        <h4>{o.shipM === 'pickup' ? 'Store pickup' : 'Deliver to'}</h4>
        {o.shipM === 'pickup' ? 'Customer collects from the store.' : <>{v.addr}{o.address.district ? ' (' + o.address.district + ' district)' : ''}</>}
        <div className="muted" style={{ marginTop: 4 }}>{v.shipName} · {v.shipL}</div>
      </div>

      {(o.sellerNote || o.note) && (
        <div className="block stack" style={{ gap: 8 }}>
          {o.sellerNote && <div className="notebox" style={{ background: 'var(--a-warn-bg)' }}><b>Note from customer</b><br />{o.sellerNote}</div>}
          {o.note && <div className="notebox" style={{ background: 'var(--a-brand-soft)' }}><b>Gift message</b><br />{o.note}</div>}
        </div>
      )}

      <div className="block">
        <h4>Payment · {o.pay}{o.payBank ? ' · ' + o.payBank : ''}</h4>
        {o.payMethod === 'bank' && (
          <>
            {receipts.length === 0 && pay !== 'Paid' && <div className="muted" style={{ marginBottom: 8 }}>No receipt uploaded yet. The customer may send it on WhatsApp with order number {o.id}.</div>}
            {receipts.length > 0 && (
              <div className="receipts" style={{ marginBottom: 10 }}>
                {receipts.map((p) => {
                  const l = links.find((x) => x.path === p);
                  const pdf = p.toLowerCase().endsWith('.pdf');
                  return <a key={p} href={l?.url ?? '#'} target="_blank" rel="noreferrer" aria-label="Open receipt">{l && !pdf ? <img src={l.url} alt="Receipt" /> : pdf ? 'PDF receipt' : 'Loading…'}</a>;
                })}
              </div>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pay !== 'Paid' && <button type="button" className="btn sm" onClick={approve}>Approve payment · {money(o.total)}</button>}
          {pay === 'Receipt sent' && <button type="button" className="btn sm ghost danger" onClick={reject}>Reject receipt</button>}
          {pay === 'Paid' && <button type="button" className="btn-xs" onClick={reopen}>Mark as unpaid</button>}
        </div>
      </div>

      <div className="block">
        <h4>Delivery tracking</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
          <select className="input" aria-label="Courier" value={courier} onChange={(e) => setCourier(e.target.value)}>{COURIERS.map((c) => <option key={c}>{c}</option>)}</select>
          <input className="input" aria-label="Tracking number" placeholder="Tracking number" value={num} onChange={(e) => setNum(e.target.value)} />
        </div>
        <input className="input" style={{ marginTop: 8 }} aria-label="Tracking link" placeholder="Tracking link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div style={{ marginTop: 8 }}><button type="button" className="btn-xs" disabled={!num.trim()} onClick={saveTracking}>Save tracking</button></div>
      </div>

      <div className="block">
        <h4>Items</h4>
        {o.items.map((l, i) => (
          <div key={i} className="row-between" style={{ alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
            <span>{l.qty} × {l.name}<br /><span className="muted" style={{ fontSize: 12 }}>{lineText(l)}</span></span>
            <span style={{ whiteSpace: 'nowrap' }}>{money(l.unit * l.qty)}</span>
          </div>
        ))}
        <div className="row-between" style={{ marginTop: 8 }}><span>Subtotal</span><span>{money(o.sub)}</span></div>
        {o.disc > 0 && <div className="row-between" style={{ color: 'var(--a-good)' }}><span>Discount {o.code}</span><span>-{money(o.disc)}</span></div>}
        <div className="row-between"><span>Delivery</span><span>{v.shipL}</span></div>
        {o.wrap > 0 && <div className="row-between"><span>Gift wrap</span><span>{money(o.wrap)}</span></div>}
        <div className="row-between" style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}><span>Total</span><span>{money(o.total)}</span></div>
      </div>

      <div className="block" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {next && <button type="button" className="btn sm" onClick={() => setStatus(next)}>Mark {next}</button>}
        {canCancel && <button type="button" className="btn sm ghost danger" onClick={() => setStatus('Cancelled')}>Cancel order</button>}
      </div>

      <div className="tl">{(o.log || []).map((g, i) => <div key={i}>{g.s} · {new Date(g.d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>)}</div>
    </aside>
  );
}
