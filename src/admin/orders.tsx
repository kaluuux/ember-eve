import { useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY, fmtDate, get, money, set, useStored, withDefaults, DEFAULT_SETTINGS } from '../store';
import { go } from '../router';
import { remote } from '../remote';
import { receiptLinks, useRole } from '../sync';
import { NO_COSTS, cashOf, profitOf, type Costs } from '../profit';
import { lineText, orderView } from '../commerce';
import { PageHead, PayBadge, StatusBadge, downloadCsv, payOf, waLink } from './ui';
import type { Order, OrderStatus, Product, Settings } from '../types';

type Flash = (m: string) => void;
const STATUS_FILTERS = ['All', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'] as const;
/** Quick views on top of the status filter */
type Quick = '' | 'topack' | 'cancel';
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
  const [quick, setQuick] = useState<Quick>('');
  const [picked, setPicked] = useState<string[]>([]);
  const role = useRole();
  const staff = remote && role === 'staff';
  useEffect(() => { if (status) setFil(status); if (pay) setPayFil(pay as PayFilter); }, [status, pay]);

  const q = search.toLowerCase();
  const rows = useMemo(
    () => orders.slice().sort((a, b) => b.date.localeCompare(a.date)).filter((o) => (fil === 'All' || o.status === fil) && matchPay(o, payFil) && (!quick || (quick === 'topack' ? o.status === 'Processing' && payOf(o) === 'Paid' && !o.packed && o.shipM !== 'digital' : o.cancelRequest?.state === 'pending' && o.status !== 'Cancelled')) && (!q || (o.id + o.name + o.email + o.phone).toLowerCase().includes(q))),
    [orders, fil, payFil, q, quick],
  );
  const count = (f: string) => orders.filter((o) => f === 'All' || o.status === f).length;
  const payCount = (f: PayFilter) => orders.filter((o) => o.status !== 'Cancelled' && matchPay(o, f)).length;
  const selO = orders.find((o) => o.id === sel);
  const toPack = orders.filter((o) => o.status === 'Processing' && payOf(o) === 'Paid' && !o.packed && o.shipM !== 'digital').length;
  const cancelAsks = orders.filter((o) => o.cancelRequest?.state === 'pending' && o.status !== 'Cancelled').length;
  const pickedOrders = orders.filter((o) => picked.includes(o.id));
  const allPicked = rows.length > 0 && rows.every((o) => picked.includes(o.id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.concat(id)));

  /** Move many orders on in one go. Unpaid orders are not dispatched; cancelled and finished ones are left alone. */
  const bulk = (st: 'Dispatched' | 'Delivered' | 'packed') => {
    let done = 0, skipped = 0;
    const list = get<Order[]>('orders', []).map((x) => {
      if (!picked.includes(x.id)) return x;
      const n = JSON.parse(JSON.stringify(x)) as Order;
      if (st === 'packed') { if (x.status === 'Processing' || x.status === 'Dispatched') { n.packed = true; done++; } else skipped++; return n; }
      const ok = st === 'Dispatched' ? x.status === 'Processing' && payOf(x) === 'Paid' : (x.status === 'Dispatched' || x.status === 'Processing') && payOf(x) === 'Paid';
      if (!ok) { skipped++; return x; }
      n.status = st; n.log = (n.log || []).concat({ s: st, d: new Date().toISOString() }); done++;
      return n;
    });
    set('orders', list);
    flash(done + ' order' + (done === 1 ? '' : 's') + ' updated' + (skipped ? ', ' + skipped + ' skipped (unpaid or already past that step)' : ''));
    setPicked([]);
  };
  const printLabels = () => window.open('/labels?ids=' + picked.join(','), '_blank');

  const exportCsv = () => {
    const head = ['Order', 'Date', 'Status', 'Payment status', 'Payment method', 'Paid to bank', 'Customer', 'Email', 'Phone', 'Delivery', 'Address', 'District', 'Items', 'Subtotal', 'Discount', 'Code', 'Delivery fee', 'Gift wrap', 'Total', 'Courier', 'Tracking', 'Customer note', 'Gift message'];
    const body = rows.map((o) => [o.id, o.date.slice(0, 10), o.status, payOf(o), o.pay, o.payBank ?? '', o.name, o.email, o.phone, o.shipM, [o.address.a1, o.address.a2, o.address.city, o.address.post].filter(Boolean).join(', '), o.address.district ?? '', o.items.map((i) => i.qty + ' x ' + i.name + ' (' + lineText(i) + ')').join(' | '), o.sub, o.disc, o.code, o.ship, o.wrap, o.total, o.tracking?.courier ?? '', o.tracking?.number ?? '', o.sellerNote ?? '', o.note]);
    downloadCsv('orders', [head, ...body]);
  };

  return (
    <>
      <PageHead title="Orders" sub={rows.length + ' of ' + orders.length + ' orders shown'} actions={!staff && <button type="button" className="btn ghost sm" onClick={exportCsv}>Export CSV</button>} />
      <div className="filters">
        {STATUS_FILTERS.map((c) => <button key={c} type="button" className={'chip' + (fil === c ? ' on' : '')} onClick={() => setFil(c)}>{c}<small>{count(c)}</small></button>)}
        <span className="sep" />
        {!staff && PAY_FILTERS.map(([k, l]) => <button key={k} type="button" className={'chip' + (payFil === k ? ' on' : '')} onClick={() => setPayFil(k)}>{l}{k !== 'all' && <small>{payCount(k)}</small>}</button>)}
        <button type="button" className={'chip' + (quick === 'topack' ? ' on' : '')} onClick={() => setQuick(quick === 'topack' ? '' : 'topack')}>To pack<small>{toPack}</small></button>
        {cancelAsks > 0 && <button type="button" className={'chip' + (quick === 'cancel' ? ' on' : '')} onClick={() => setQuick(quick === 'cancel' ? '' : 'cancel')}>Cancel requests<small>{cancelAsks}</small></button>}
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, name, email, phone" aria-label="Search orders" style={{ width: 280, marginLeft: 'auto' }} />
      </div>

      {picked.length > 0 && (
        <div className="bulkbar" role="region" aria-label="Bulk actions">
          <b>{picked.length} selected</b>
          <button type="button" className="btn-xs" onClick={() => bulk('packed')}>Mark packed</button>
          <button type="button" className="btn-xs" onClick={() => bulk('Dispatched')}>Mark dispatched</button>
          <button type="button" className="btn-xs" onClick={() => bulk('Delivered')}>Mark delivered</button>
          <button type="button" className="btn-xs" onClick={printLabels}>Print {pickedOrders.filter((o) => o.shipM !== 'pickup' && o.shipM !== 'digital').length} labels</button>
          <button type="button" className="btn-xs" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}

      <div className={'orders-layout' + (selO ? ' open' : '')}>
        <div className="card flush" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Select all shown" checked={allPicked} onChange={() => setPicked(allPicked ? [] : rows.map((o) => o.id))} /></th><th>Order</th><th>Date</th><th>Customer</th>{!staff && <th style={{ textAlign: 'right' }}>Total</th>}{!staff && <th>Payment</th>}<th>Status</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={'click' + (sel === o.id ? ' sel' : '')} onClick={() => go('admin/orders?sel=' + o.id)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={'Select ' + o.id} checked={picked.includes(o.id)} onChange={() => toggle(o.id)} /></td>
                  <td style={{ fontWeight: 600 }}>{o.id}{o.cancelRequest?.state === 'pending' && o.status !== 'Cancelled' && <span className="tag" style={{ marginLeft: 6, background: 'var(--a-bad-bg)', color: 'var(--a-bad)' }}>Wants to cancel</span>}</td>
                  <td>{fmtDate(o.date, { day: 'numeric', month: 'short' })}</td>
                  <td>{o.name}<div className="muted" style={{ fontSize: 12 }}>{o.phone || o.email}</div></td>
                  {!staff && <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(cashOf(o))}</td>}
                  {!staff && <td><PayBadge o={o} /></td>}
                  <td><StatusBadge status={o.status} />{o.packed && o.status === 'Processing' && <span className="tag" style={{ marginLeft: 6, background: 'var(--a-info-bg)', color: 'var(--a-info)' }}>Packed</span>}</td>
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
  const role = useRole();
  const staff = remote && role === 'staff';
  const costs = useStored<Costs>('costs', NO_COSTS);
  const [links, setLinks] = useState<{ path: string; url: string }[]>([]);
  const [courier, setCourier] = useState(o.tracking?.courier || 'Domex');
  const [num, setNum] = useState(o.tracking?.number ?? '');
  const [url, setUrl] = useState(o.tracking?.url ?? '');
  const [note, setNote] = useState(o.adminNote ?? '');
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
  const packToggle = () => update((x) => { x.packed = !x.packed; }, o.packed ? 'Marked as not packed' : 'Marked as packed');
  const approveCancel = () => { setStatus('Cancelled'); };
  const declineCancel = () => update((x) => { if (x.cancelRequest) x.cancelRequest = { ...x.cancelRequest, state: 'declined' }; log(x, 'Cancellation request declined'); }, 'Request declined');
  const approve = () => update((x) => { x.payStatus = 'Paid'; log(x, 'Payment approved'); }, 'Payment approved for ' + o.id);
  const reject = () => update((x) => { x.payStatus = 'Failed'; log(x, 'Payment rejected'); }, 'Payment marked as rejected');
  const reopen = () => update((x) => { x.payStatus = 'Pending'; log(x, 'Payment reopened'); }, 'Payment reopened');
  const saveNote = () => update((x) => { x.adminNote = note.trim(); }, 'Note saved');
  const saveTracking = () => update((x) => { x.tracking = { courier, number: num.trim(), url: url.trim() }; log(x, 'Tracking added'); }, 'Tracking saved');

  const next = ({ Processing: 'Dispatched', Dispatched: 'Delivered' } as Partial<Record<OrderStatus, OrderStatus>>)[o.status];
  const canCancel = !staff && (o.status === 'Processing' || o.status === 'Dispatched');
  const pr = profitOf(o, costs);
  const pay = payOf(o);
  const hello = 'Hi ' + (o.first || o.name.split(' ')[0]) + ', this is ' + settings.shop + ' about your order ' + o.id + '. ';

  /** Full order confirmation message the admin can copy-paste into WhatsApp */
  const waMsg = [
    'Dear ' + (o.first || o.name.split(' ')[0]) + ',',
    '',
    'Thank you for your order with ' + settings.shop + '.',
    '',
    'Order Reference: ' + o.id,
    'Date: ' + new Date(o.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    '',
    'You may view your invoice here: ' + window.location.origin + '/invoice/' + o.id,
    '',
    'We will notify you once your order has been dispatched.',
    'Thank you for shopping with us.',
  ].join('\n');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyMsg = () => {
    void navigator.clipboard.writeText(waMsg);
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="panel detail" aria-label={'Order ' + o.id}>
      <div className="row-between">
        <div>
          <div className="h3" style={{ fontSize: 20 }}>{o.id}</div>
          <div className="muted" style={{ fontSize: 12 }}>{new Date(o.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <button type="button" className="btn-xs" onClick={() => go('admin/orders')}>Close</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatusBadge status={o.status} />{!staff && <PayBadge o={o} />}{o.packed && <span className="tag" style={{ background: 'var(--a-info-bg)', color: 'var(--a-info)' }}>Packed</span>}</div>

      {o.cancelRequest?.state === 'pending' && o.status !== 'Cancelled' && (
        <div className="notebox" style={{ background: 'var(--a-bad-bg)' }}>
          <b>The customer asked to cancel this order</b>{o.cancelRequest.reason ? <><br />“{o.cancelRequest.reason}”</> : null}
          {!staff ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn sm danger" onClick={approveCancel}>Approve and cancel</button>
              <button type="button" className="btn-xs" onClick={declineCancel}>Decline</button>
            </div>
          ) : <div className="muted" style={{ marginTop: 6 }}>Do not dispatch. The owner will decide.</div>}
        </div>
      )}

      <div className="block">
        <h4>Customer</h4>
        <b>{o.name}</b><br />{!staff && <>{o.email}<br /></>}{o.phone}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {o.phone && <a className="btn-xs" href={waLink(o.phone, waMsg)} target="_blank" rel="noreferrer">WhatsApp customer</a>}
          {o.phone && <a className="btn-xs" href={'tel:' + o.phone}>Call</a>}
          {!staff && <a className="btn-xs" href={'/invoice/' + o.id + '?back=admin/orders%3Fsel%3D' + o.id} target="_blank" rel="noreferrer">Invoice</a>}
          {!staff && <a className="btn-xs" href={'mailto:' + o.email + '?subject=' + encodeURIComponent('Your order ' + o.id)}>Email</a>}
        </div>
        {o.phone && (
          <div className="notebox" style={{ background: 'var(--a-brand-soft)', marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 12 }}>📋 WhatsApp Message</b>
              <button type="button" className="btn-xs" onClick={copyMsg} style={{ minWidth: 70 }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', color: 'var(--text2)', lineHeight: 1.6 }}>{waMsg}</pre>
          </div>
        )}
      </div>

      <div className="block">
        <h4>{o.shipM === 'pickup' ? 'Store pickup' : 'Deliver to'}</h4>
        {o.shipM === 'pickup' ? 'Customer collects from the store.' : <>{v.addr}{o.address.district ? ' (' + o.address.district + ' district)' : ''}</>}
        <div className="muted" style={{ marginTop: 4 }}>{v.shipName}{staff ? '' : ' · ' + v.shipL}</div>
        {o.shipM !== 'pickup' && o.shipM !== 'digital' && <div style={{ marginTop: 8 }}><a className="btn-xs" href={'/labels?ids=' + o.id} target="_blank" rel="noreferrer">Print courier label</a></div>}
      </div>

      {(o.sellerNote || o.note) && (
        <div className="block stack" style={{ gap: 8 }}>
          {o.sellerNote && <div className="notebox" style={{ background: 'var(--a-warn-bg)' }}><b>Note from customer</b><br />{o.sellerNote}</div>}
          {o.note && <div className="notebox" style={{ background: 'var(--a-brand-soft)' }}><b>Gift message</b><br />{o.note}</div>}
        </div>
      )}

      {!staff && <div className="block">
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
          {pay !== 'Paid' && <button type="button" className="btn sm" onClick={approve}>Approve payment · {money(cashOf(o))}</button>}
          {pay === 'Receipt sent' && <button type="button" className="btn sm ghost danger" onClick={reject}>Reject receipt</button>}
          {pay === 'Paid' && <button type="button" className="btn-xs" onClick={reopen}>Mark as unpaid</button>}
        </div>
      </div>}

      <div className="block">
        <h4>Delivery tracking</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
          <select className="input" aria-label="Courier" value={courier} onChange={(e) => setCourier(e.target.value)}>{COURIERS.map((c) => <option key={c}>{c}</option>)}</select>
          <input className="input" aria-label="Tracking number" placeholder="Tracking number" value={num} onChange={(e) => setNum(e.target.value)} />
        </div>
        <input className="input" style={{ marginTop: 8 }} aria-label="Tracking link" placeholder="Tracking link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div style={{ marginTop: 8 }}><button type="button" className="btn-xs" disabled={!num.trim()} onClick={saveTracking}>Save tracking</button></div>
      </div>

      {!staff && <div className="block">
        <h4>Internal note (only you can see this)</h4>
        <textarea className="input" rows={2} aria-label="Internal note" placeholder="e.g. regular customer, wrap extra carefully, called to confirm" value={note} onChange={(e) => setNote(e.target.value)} />
        <div style={{ marginTop: 8 }}><button type="button" className="btn-xs" disabled={note.trim() === (o.adminNote ?? '')} onClick={saveNote}>Save note</button></div>
      </div>}

      <div className="block">
        <h4>Items</h4>
        {o.items.map((l, i) => (
          <div key={i} className="row-between" style={{ alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
            <span>{l.qty} × {l.name}<br /><span className="muted" style={{ fontSize: 12 }}>{lineText(l)}</span></span>
            {!staff && <span style={{ whiteSpace: 'nowrap' }}>{money(l.unit * l.qty)}</span>}
          </div>
        ))}
        {!staff && <>
          <div className="row-between" style={{ marginTop: 8 }}><span>Subtotal</span><span>{money(o.sub)}</span></div>
          {o.disc > 0 && <div className="row-between" style={{ color: 'var(--a-good)' }}><span>Discount {o.code}</span><span>-{money(o.disc)}</span></div>}
          {!!o.refDisc && <div className="row-between" style={{ color: 'var(--a-good)' }}><span>Friend referral</span><span>-{money(o.refDisc)}</span></div>}
          <div className="row-between"><span>Delivery</span><span>{v.shipL}</span></div>
          {o.wrap > 0 && <div className="row-between"><span>Gift wrap</span><span>{money(o.wrap)}</span></div>}
          <div className="row-between" style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}><span>Total</span><span>{money(o.total)}</span></div>
          {!!o.gcApplied && <div className="row-between" style={{ color: 'var(--a-good)' }}><span>Gift card {o.gcCode}</span><span>-{money(o.gcApplied)}</span></div>}
          {!!o.creditApplied && <div className="row-between" style={{ color: 'var(--a-good)' }}><span>Store credit</span><span>-{money(o.creditApplied)}</span></div>}
          {(!!o.gcApplied || !!o.creditApplied) && <div className="row-between" style={{ fontWeight: 700 }}><span>To pay</span><span>{money(cashOf(o))}</span></div>}
          <div className="row-between muted" style={{ marginTop: 8, fontSize: 13 }}><span>Profit on candles{pr.known ? '' : ' (some costs not set)'}</span><span>{money(pr.profit)}</span></div>
        </>}
        {!!o.giftCards?.length && !staff && <div className="notebox" style={{ background: 'var(--a-brand-soft)', marginTop: 8 }}><b>Gift cards issued</b>{o.giftCards.map((g) => <div key={g.code}>{g.code} · {money(g.amount)}{g.to ? ' for ' + g.to : ''}</div>)}</div>}
      </div>

      {staff && o.shipM !== 'digital' && (
        <div className="block" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn sm ghost" onClick={packToggle}>{o.packed ? 'Un-pack' : 'Mark packed'}</button>
        </div>
      )}

      <div className="block" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!staff && o.shipM !== 'digital' && o.status === 'Processing' && <button type="button" className="btn sm ghost" onClick={packToggle}>{o.packed ? 'Un-pack' : 'Mark packed'}</button>}
        {next && (!staff || pay === 'Paid') && <button type="button" className="btn sm" onClick={() => setStatus(next)}>Mark {next}</button>}
        {staff && next && pay !== 'Paid' && <span className="muted">Not paid yet. Wait for the owner to approve payment.</span>}
        {canCancel && <button type="button" className="btn sm ghost danger" onClick={() => setStatus('Cancelled')}>Cancel order</button>}
      </div>

      <div className="tl">{(o.log || []).map((g, i) => <div key={i}>{g.s} · {new Date(g.d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>)}</div>
    </aside>
  );
}
