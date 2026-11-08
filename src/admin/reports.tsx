import { useMemo, useState, type ReactNode } from 'react';
import { EMPTY, money, useStored } from '../store';
import { PageHead, compact, downloadCsv, payOf } from './ui';
import { NO_COSTS, cashOf, profitOf, type Costs } from '../profit';
import type { Category, Order, Product, User } from '../types';

const DAY = 86400000;
type Preset = '7' | '30' | '90' | 'month' | 'lastmonth' | 'year' | 'all' | 'custom';
const PRESETS: [Preset, string][] = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']];

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = (t: number) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '0%');

/** Start (inclusive) and end (exclusive) of the chosen period, in ms. */
function periodOf(p: Preset, from: string, to: string, first: number, now: number): [number, number] {
  const today = startOfDay(now), tomorrow = today + DAY, d = new Date(now);
  if (p === '7' || p === '30' || p === '90') return [tomorrow - Number(p) * DAY, tomorrow];
  if (p === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), tomorrow];
  if (p === 'lastmonth') return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime()];
  if (p === 'year') return [new Date(d.getFullYear(), 0, 1).getTime(), tomorrow];
  if (p === 'custom') {
    const a = from ? parseYmd(from) : today - 29 * DAY, b = (to ? parseYmd(to) : today) + DAY;
    return a < b ? [a, b] : [b - DAY, a + DAY];
  }
  return [startOfDay(first), tomorrow];
}

interface Bucket { label: string; from: number; to: number; value: number; orders: number }
function buckets(start: number, end: number, paid: Order[]): Bucket[] {
  const days = Math.max(1, Math.round((end - start) / DAY));
  const out: Bucket[] = [];
  const fmt = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString('en-GB', o);
  if (days <= 45) {
    for (let t = start; t < end; t += DAY) out.push({ label: fmt(t, { day: 'numeric', month: 'short' }), from: t, to: t + DAY, value: 0, orders: 0 });
  } else if (days <= 200) {
    for (let t = start; t < end; t += 7 * DAY) out.push({ label: 'Week of ' + fmt(t, { day: 'numeric', month: 'short' }), from: t, to: Math.min(t + 7 * DAY, end), value: 0, orders: 0 });
  } else {
    const s = new Date(start);
    for (let t = new Date(s.getFullYear(), s.getMonth(), 1).getTime(); t < end; t = new Date(new Date(t).getFullYear(), new Date(t).getMonth() + 1, 1).getTime()) {
      out.push({ label: fmt(t, { month: 'short', year: '2-digit' }), from: t, to: new Date(new Date(t).getFullYear(), new Date(t).getMonth() + 1, 1).getTime(), value: 0, orders: 0 });
    }
  }
  paid.forEach((o) => {
    const t = new Date(o.date).getTime();
    const b = out.find((x) => t >= x.from && t < x.to);
    if (b) { b.value += cashOf(o); b.orders += 1; }
  });
  return out;
}
function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return cur > 0 ? <span className="delta up">new</span> : null;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return <span className="delta flat">no change</span>;
  return <span className={'delta ' + (p > 0 ? 'up' : 'down')}>{p > 0 ? '▲' : '▼'} {Math.abs(p)}%</span>;
}
function Kpi({ label, value, cur, prev, note }: { label: string; value: string; cur?: number; prev?: number; note?: string }) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      <div className="k-sub">{cur !== undefined && prev !== undefined && <Delta cur={cur} prev={prev} />}{note && <span>{note}</span>}</div>
    </div>
  );
}

function Table({ title, sub, head, rows, onCsv, empty }: { title: string; sub?: string; head: string[]; rows: ReactNode[][]; onCsv?: () => void; empty: string }) {
  return (
    <div className="panel" style={{ minWidth: 0 }}>
      <div className="panel-head">
        <div><div className="h3">{title}</div>{sub && <div className="sub">{sub}</div>}</div>
        {onCsv && rows.length > 0 && <button type="button" className="btn-xs" onClick={onCsv}>Export CSV</button>}
      </div>
      {rows.length === 0 ? <div className="empty">{empty}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr>{head.map((h, i) => <th key={h} style={i ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j ? { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } : undefined}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportsView() {
  const orders = useStored<Order[]>('orders', EMPTY);
  const products = useStored<Product[]>('products', EMPTY);
  const categories = useStored<Category[]>('categories', EMPTY);
  const users = useStored<User[]>('users', EMPTY);
  const costs = useStored<Costs>('costs', NO_COSTS);
  const [preset, setPreset] = useState<Preset>('30');
  const [from, setFrom] = useState(() => ymd(Date.now() - 29 * DAY));
  const [to, setTo] = useState(() => ymd(Date.now()));
  const [hover, setHover] = useState(-1);

  const r = useMemo(() => {
    const now = Date.now();
    const first = orders.reduce((a, o) => Math.min(a, new Date(o.date).getTime()), now);
    const [start, end] = periodOf(preset, from, to, first, now);
    const span = end - start;
    const inRange = (o: Order, a: number, b: number) => { const t = new Date(o.date).getTime(); return t >= a && t < b; };
    const live = orders.filter((o) => o.status !== 'Cancelled');
    const cur = live.filter((o) => inRange(o, start, end));
    const prev = preset === 'all' ? [] : live.filter((o) => inRange(o, start - span, start));
    const paidOf = (l: Order[]) => l.filter((o) => payOf(o) === 'Paid');
    const sum = (l: Order[]) => l.reduce((a, o) => a + cashOf(o), 0);
    const units = (l: Order[]) => l.reduce((a, o) => a + o.items.reduce((x, i) => x + (i.kind === 'giftcard' ? 0 : i.qty), 0), 0);
    const gross = (l: Order[]) => l.reduce((a, o) => { const g = profitOf(o, costs); return { profit: a.profit + g.profit, goods: a.goods + g.goods, partial: a.partial || !g.known }; }, { profit: 0, goods: 0, partial: false });
    const paid = paidOf(cur), paidPrev = paidOf(prev);

    // returning customers: an order whose email (or account) ordered before it
    const seen = new Map<string, number>();
    live.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((o) => { const k = (o.email || String(o.userId)).toLowerCase(); if (!seen.has(k)) seen.set(k, new Date(o.date).getTime()); });
    const returning = cur.filter((o) => (seen.get((o.email || String(o.userId)).toLowerCase()) ?? 0) < new Date(o.date).getTime() - 1000).length;

    const catOf = (pid: number) => categories.find((c) => c.id === products.find((p) => p.id === pid)?.cat)?.name ?? 'Other';
    const byProd: Record<string, { units: number; rev: number; profit: number }> = {};
    const byCat: Record<string, { units: number; rev: number }> = {};
    const byDistrict: Record<string, { orders: number; rev: number }> = {};
    const byCode: Record<string, { uses: number; given: number; rev: number }> = {};
    const byPay: Record<string, number> = {}, byShip: Record<string, number> = {}, byStatus: Record<string, number> = {};
    orders.filter((o) => inRange(o, start, end)).forEach((o) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });
    let giftCardSales = 0;
    cur.forEach((o) => {
      const d = o.address?.district || (o.shipM === 'pickup' ? 'Store pickup' : o.shipM === 'digital' ? 'Digital' : 'Not set');
      const e = (byDistrict[d] ??= { orders: 0, rev: 0 }); e.orders += 1; e.rev += cashOf(o);
      if (o.code) { const c = (byCode[o.code] ??= { uses: 0, given: 0, rev: 0 }); c.uses += 1; c.given += o.disc || 0; c.rev += cashOf(o); }
      byPay[o.pay || 'Unknown'] = (byPay[o.pay || 'Unknown'] ?? 0) + 1;
      byShip[o.shipM] = (byShip[o.shipM] ?? 0) + 1;
      o.items.forEach((i) => {
        if (i.kind === 'giftcard') { giftCardSales += i.unit * i.qty; return; }
        const name = i.pid ? i.name : 'Gift boxes', cat = i.pid ? catOf(i.pid) : 'Gift boxes';
        const lc = typeof i.cost === 'number' ? i.cost * i.qty : i.pid ? (costs[String(i.pid)] ?? 0) * i.qty : 0;
        const p = (byProd[name] ??= { units: 0, rev: 0, profit: 0 }); p.units += i.qty; p.rev += i.unit * i.qty; p.profit += i.unit * i.qty - lc;
        const c = (byCat[cat] ??= { units: 0, rev: 0 }); c.units += i.qty; c.rev += i.unit * i.qty;
      });
    });
    const waiting = cur.filter((o) => payOf(o) !== 'Paid');
    return {
      start, end, cur, prev, paid, paidPrev, rev: sum(paid), revPrev: sum(paidPrev), gp: gross(paid), gpPrev: gross(paidPrev),
      aov: cur.length ? sum(cur) / cur.length : 0, aovPrev: prev.length ? sum(prev) / prev.length : 0,
      units: units(cur), unitsPrev: units(prev), returning, waiting, waitingSum: sum(waiting),
      byProd, byCat, byDistrict, byCode, byPay, byShip, byStatus, giftCardSales,
      newCust: users.filter((u) => { const j = new Date(u.joined).getTime(); return j >= start && j < end; }).length,
      buckets: buckets(start, end, paid),
    };
  }, [orders, products, categories, users, costs, preset, from, to]);

  const periodWord = new Date(r.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' to ' + new Date(r.end - DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const axis = niceMax(Math.max(0, ...r.buckets.map((b) => b.value)));
  const vs = preset === 'all' ? undefined : 'vs previous period';
  const prods = Object.entries(r.byProd).sort((a, b) => b[1].rev - a[1].rev);
  const cats = Object.entries(r.byCat).sort((a, b) => b[1].rev - a[1].rev);
  const catTotal = cats.reduce((a, [, v]) => a + v.rev, 0);
  const dists = Object.entries(r.byDistrict).sort((a, b) => b[1].rev - a[1].rev);
  const codes = Object.entries(r.byCode).sort((a, b) => b[1].uses - a[1].uses);
  const label = (m: string) => ({ standard: 'Standard delivery', express: 'Express delivery', pickup: 'Store pickup', digital: 'Digital (gift card)' } as Record<string, string>)[m] ?? m;

  const exportOrders = () => downloadCsv('sales-orders', [
    ['Order', 'Date', 'Customer', 'Email', 'District', 'Status', 'Payment status', 'Payment', 'Delivery', 'Items', 'Subtotal', 'Discount', 'Code', 'Delivery fee', 'Total', 'Collected'],
    ...r.cur.slice().sort((a, b) => a.date.localeCompare(b.date)).map((o) => [o.id, o.date.slice(0, 10), o.name, o.email, o.address?.district ?? '', o.status, payOf(o), o.pay, label(o.shipM), o.items.map((i) => i.qty + ' x ' + i.name).join('; '), o.sub, o.disc, o.code, o.ship, o.total, cashOf(o)]),
  ]);
  const exportSummary = () => downloadCsv('sales-summary', [
    ['Period', periodWord], ['Revenue (paid)', Math.round(r.rev)], ['Orders', r.cur.length], ['Average order value', Math.round(r.aov)], ['Units sold', r.units], ['Profit', Math.round(r.gp.profit)], [],
    ['Top products', 'Units', 'Revenue', 'Profit'], ...prods.map(([n, v]) => [n, v.units, Math.round(v.rev), Math.round(v.profit)]), [],
    ['Category', 'Units', 'Revenue'], ...cats.map(([n, v]) => [n, v.units, Math.round(v.rev)]), [],
    ['District', 'Orders', 'Revenue'], ...dists.map(([n, v]) => [n, v.orders, Math.round(v.rev)]), [],
    ['Discount code', 'Uses', 'Discount given', 'Revenue'], ...codes.map(([n, v]) => [n, v.uses, Math.round(v.given), Math.round(v.rev)]),
  ]);

  return (
    <>
      <PageHead
        title="Sales reports"
        sub={periodWord + '. Revenue is money received on approved orders; the other figures count every order that was not cancelled.'}
        actions={<><button type="button" className="btn ghost sm" onClick={exportOrders}>Export orders</button><button type="button" className="btn ghost sm" onClick={exportSummary}>Export summary</button></>}
      />
      <div className="filters">
        {PRESETS.map(([k, l]) => <button key={k} type="button" className={'chip' + (preset === k ? ' on' : '')} aria-pressed={preset === k} onClick={() => setPreset(k)}>{l}</button>)}
        {preset === 'custom' && (
          <>
            <span className="sep" />
            <label style={{ fontSize: 13 }}>From <input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto', padding: '6px 8px' }} /></label>
            <label style={{ fontSize: 13 }}>To <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto', padding: '6px 8px' }} /></label>
          </>
        )}
      </div>

      <div className="kpis">
        <Kpi label="Revenue (paid)" value={money(r.rev)} cur={r.rev} prev={r.revPrev} note={vs} />
        <Kpi label="Orders" value={String(r.cur.length)} cur={r.cur.length} prev={r.prev.length} note={vs} />
        <Kpi label="Average order" value={money(r.aov)} cur={r.aov} prev={r.aovPrev} note={vs} />
        <Kpi label="Candles sold" value={String(r.units)} cur={r.units} prev={r.unitsPrev} note={vs} />
        <Kpi label="Profit" value={money(r.gp.profit)} cur={r.gp.profit} prev={r.gpPrev.profit} note={(r.gp.goods > 0 ? Math.round((r.gp.profit / r.gp.goods) * 100) + '% margin' : 'on candles') + (r.gp.partial ? ' · some costs not set' : '')} />
        <Kpi label="Returning customers" value={pct(r.returning, r.cur.length)} note={r.returning + ' of ' + r.cur.length + ' orders'} />
        <Kpi label="New accounts" value={String(r.newCust)} note="signed up in this period" />
        <Kpi label="Awaiting payment" value={money(r.waitingSum)} note={r.waiting.length + (r.waiting.length === 1 ? ' order' : ' orders')} />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><div><div className="h3">Revenue over time</div><div className="sub">Paid orders, by {(r.end - r.start) / DAY <= 45 ? 'day' : (r.end - r.start) / DAY <= 200 ? 'week' : 'month'}</div></div></div>
        <div className={'cols' + (hover >= 0 ? ' dim' : '')} role="img" aria-label="Revenue chart">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <div key={f} className="grid-line" style={{ bottom: f * 100 + '%' }}><span>{compact(axis * f)}</span></div>)}
          <div className="bars">
            {r.buckets.map((b, i) => (
              <div key={b.from} className="slot" tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)} onFocus={() => setHover(i)} onBlur={() => setHover(-1)}>
                <div className="bar" style={{ height: (b.value / axis) * 100 + '%' }} />
                {hover === i && <div className="tip"><b>{money(b.value)}</b>{b.label} · {b.orders} {b.orders === 1 ? 'order' : 'orders'}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="xaxis"><span>{r.buckets[0]?.label}</span><span>{r.buckets[r.buckets.length - 1]?.label}</span></div>
      </div>

      <div className="dash-grid">
        <div className="span-6"><Table title="Top products" sub="By revenue" head={['Candle', 'Sold', 'Revenue', 'Profit']} empty="No sales in this period."
          rows={prods.slice(0, 15).map(([n, v]) => [n, v.units, money(v.rev), money(v.profit)])}
          onCsv={() => downloadCsv('products-sold', [['Product', 'Units', 'Revenue', 'Profit'], ...prods.map(([n, v]) => [n, v.units, Math.round(v.rev), Math.round(v.profit)])])} /></div>
        <div className="span-6"><Table title="Sales by category" head={['Category', 'Sold', 'Revenue', 'Share']} empty="No sales in this period."
          rows={cats.map(([n, v]) => [n, v.units, money(v.rev), pct(v.rev, catTotal)])} /></div>
        <div className="span-6"><Table title="Where orders go" sub="Delivery district" head={['District', 'Orders', 'Revenue']} empty="No orders in this period."
          rows={dists.slice(0, 15).map(([n, v]) => [n, v.orders, money(v.rev)])}
          onCsv={() => downloadCsv('sales-by-district', [['District', 'Orders', 'Revenue'], ...dists.map(([n, v]) => [n, v.orders, Math.round(v.rev)])])} /></div>
        <div className="span-6"><Table title="Discount codes" sub="How much each code cost you" head={['Code', 'Used', 'Discount given', 'Order revenue']} empty="No codes were used in this period."
          rows={codes.map(([n, v]) => [n, v.uses, money(v.given), money(v.rev)])} /></div>
        <div className="span-6"><Table title="Payment and delivery" head={['Method', 'Orders']} empty="No orders in this period."
          rows={[...Object.entries(r.byPay).map(([n, v]) => ['Pay: ' + n, v]), ...Object.entries(r.byShip).map(([n, v]) => [label(n), v])]} /></div>
        <div className="span-6"><Table title="Order status" sub="Including cancelled" head={['Status', 'Orders']} empty="No orders in this period."
          rows={Object.entries(r.byStatus).map(([n, v]) => [n, v])} />
          {r.giftCardSales > 0 && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Gift cards sold in this period: {money(r.giftCardSales)} (not counted as candle sales).</div>}</div>
      </div>
    </>
  );
}
