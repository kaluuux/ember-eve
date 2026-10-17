import { useMemo, useState, type ReactNode } from 'react';
import { EMPTY, fmtDate, money, useStored } from '../store';
import { go } from '../router';
import { PageHead, PayBadge, STATUS_STYLE, StatusBadge, compact, payOf } from './ui';
import type { Category, Message, Order, OrderStatus, Product, Review, User } from '../types';

const DAY = 86400000;
type Range = '7' | '30' | '90' | 'all';
const RANGES: [Range, string][] = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time']];

interface Bucket { label: string; from: number; to: number; value: number; orders: number }

/** Round the top of a chart axis up to a clean number (1, 2, 5 x 10^n). */
function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function buildBuckets(paid: Order[], range: Range, now: number): Bucket[] {
  const out: Bucket[] = [];
  const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = startOfDay(now);
  if (range === '7' || range === '30') {
    const n = Number(range);
    for (let i = n - 1; i >= 0; i--) {
      const from = today - i * DAY;
      out.push({ label: new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), from, to: from + DAY, value: 0, orders: 0 });
    }
  } else if (range === '90') {
    for (let i = 12; i >= 0; i--) {
      const from = today - i * 7 * DAY;
      out.push({ label: 'Week of ' + new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), from, to: from + 7 * DAY, value: 0, orders: 0 });
    }
  } else {
    const d = new Date(now);
    for (let i = 11; i >= 0; i--) {
      const from = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
      const to = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
      out.push({ label: new Date(from).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), from, to, value: 0, orders: 0 });
    }
  }
  paid.forEach((o) => {
    const t = new Date(o.date).getTime();
    const b = out.find((x) => t >= x.from && t < x.to);
    if (b) { b.value += o.total; b.orders += 1; }
  });
  return out;
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

function HBars({ rows, empty }: { rows: { key: string; label: ReactNode; value: number; text: string; color?: string; dot?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.key} className="hbar">
          <div className="h-top"><span>{r.dot && <i className="dot" style={{ background: r.dot }} />}{r.label}</span><span>{r.text}</span></div>
          <div className="h-track"><div className="h-fill" style={{ width: (r.value / max) * 100 + '%', background: r.color }} /></div>
        </div>
      ))}
    </div>
  );
}


export function Dashboard() {
  const orders = useStored<Order[]>('orders', EMPTY);
  const products = useStored<Product[]>('products', EMPTY);
  const categories = useStored<Category[]>('categories', EMPTY);
  const users = useStored<User[]>('users', EMPTY);
  const msgs = useStored<Message[]>('messages', EMPTY);
  const reviews = useStored<Review[]>('reviews', EMPTY);
  const [range, setRange] = useState<Range>('30');
  const [hover, setHover] = useState(-1);
  const [asTable, setAsTable] = useState(false);

  const d = useMemo(() => {
    const now = Date.now(), span = range === 'all' ? Infinity : Number(range) * DAY;
    const t = (o: Order) => new Date(o.date).getTime();
    const cur = (o: Order) => now - t(o) <= span;
    const prev = (o: Order) => range !== 'all' && now - t(o) > span && now - t(o) <= 2 * span;
    const live = orders.filter((o) => o.status !== 'Cancelled');
    const paid = live.filter((o) => payOf(o) === 'Paid');
    const sum = (l: Order[]) => l.reduce((a, o) => a + o.total, 0);
    const inCur = live.filter(cur), inPrev = live.filter(prev);
    const paidCur = paid.filter(cur), paidPrev = paid.filter(prev);
    const joined = (u: User) => { const j = new Date(u.joined).getTime(); return now - j <= span; };
    const joinedPrev = (u: User) => { const j = new Date(u.joined).getTime(); return range !== 'all' && now - j > span && now - j <= 2 * span; };
    const waiting = live.filter((o) => payOf(o) !== 'Paid');
    const status: Record<OrderStatus, number> = { Processing: 0, Dispatched: 0, Delivered: 0, Cancelled: 0 };
    orders.filter(cur).forEach((o) => { status[o.status] += 1; });

    const catOf = (pid: number) => categories.find((c) => c.id === products.find((p) => p.id === pid)?.cat)?.name ?? 'Other';
    const byCat: Record<string, number> = {}, byProd: Record<string, { units: number; rev: number }> = {}, byPay: Record<string, number> = {};
    inCur.forEach((o) => {
      byPay[o.pay || 'Unknown'] = (byPay[o.pay || 'Unknown'] ?? 0) + 1;
      o.items.forEach((i) => {
        const cat = i.pid ? catOf(i.pid) : 'Gift boxes';
        byCat[cat] = (byCat[cat] ?? 0) + i.unit * i.qty;
        const name = i.pid ? i.name : 'Gift boxes';
        const e = (byProd[name] ??= { units: 0, rev: 0 });
        e.units += i.qty; e.rev += i.unit * i.qty;
      });
    });
    const lows = products.filter((p) => p.stock !== null && p.stock <= 5);
    return {
      now, paid, inCur, inPrev, paidCur, revCur: sum(paidCur), revPrev: sum(paidPrev),
      avgCur: inCur.length ? sum(inCur) / inCur.length : 0, avgPrev: inPrev.length ? sum(inPrev) / inPrev.length : 0,
      waiting, waitingSum: sum(waiting), status, byCat, byProd, byPay, lows,
      newCust: users.filter(joined).length, newCustPrev: users.filter(joinedPrev).length,
      buckets: buildBuckets(paid, range, now),
    };
  }, [orders, products, categories, users, range]);

  const toCheck = orders.filter((o) => o.status !== 'Cancelled' && payOf(o) === 'Receipt sent').length;
  const toProcess = orders.filter((o) => o.status === 'Processing' && payOf(o) === 'Paid').length;
  const unread = msgs.filter((m) => !m.read).length;
  const pendingReviews = reviews.filter((r) => !r.approved).length;

  const top = Math.max(...d.buckets.map((b) => b.value));
  const axis = niceMax(top);
  const topCats = Object.entries(d.byCat).sort((a, b) => b[1] - a[1]);
  const catTotal = topCats.reduce((a, [, v]) => a + v, 0) || 1;
  const topProds = Object.entries(d.byProd).sort((a, b) => b[1].units - a[1].units).slice(0, 6);
  const recent = orders.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const rangeWord = range === 'all' ? 'all time' : 'last ' + range + ' days';
  const chartTitle = range === '7' || range === '30' ? 'Revenue by day' : range === '90' ? 'Revenue by week' : 'Revenue by month';

  return (
    <>
      <PageHead
        title="Dashboard"
        sub={'How the shop is doing, ' + rangeWord + '. Revenue counts orders whose payment you have approved.'}
        actions={<div className="seg" role="group" aria-label="Time range">{RANGES.map(([k, l]) => <button key={k} type="button" className={range === k ? 'on' : ''} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}</div>}
      />

      {(toCheck + toProcess + unread + pendingReviews + d.lows.length > 0) && (
        <div className="attn" aria-label="Needs your attention">
          {toCheck > 0 && <a href="#/admin/orders?pay=review" className="hot"><b>{toCheck}</b><span>{toCheck === 1 ? 'receipt' : 'receipts'} to check and approve</span></a>}
          {toProcess > 0 && <a href="#/admin/orders?status=Processing"><b>{toProcess}</b><span>paid {toProcess === 1 ? 'order' : 'orders'} to pour and dispatch</span></a>}
          {unread > 0 && <a href="#/admin/messages"><b>{unread}</b><span>unread {unread === 1 ? 'message' : 'messages'}</span></a>}
          {pendingReviews > 0 && <a href="#/admin/reviews"><b>{pendingReviews}</b><span>{pendingReviews === 1 ? 'review' : 'reviews'} waiting for approval</span></a>}
          {d.lows.length > 0 && <a href="#/admin/products"><b>{d.lows.length}</b><span>{d.lows.length === 1 ? 'candle' : 'candles'} low or out of stock</span></a>}
        </div>
      )}

      <div className="kpis">
        <Kpi label="Revenue (paid)" value={money(d.revCur)} cur={d.revCur} prev={d.revPrev} note={range === 'all' ? undefined : 'vs previous ' + range + ' days'} />
        <Kpi label="Orders" value={String(d.inCur.length)} cur={d.inCur.length} prev={d.inPrev.length} note={range === 'all' ? undefined : 'vs previous'} />
        <Kpi label="Average order" value={money(d.avgCur)} cur={d.avgCur} prev={d.avgPrev} />
        <Kpi label="Awaiting payment" value={money(d.waitingSum)} note={d.waiting.length + (d.waiting.length === 1 ? ' order' : ' orders') + ' not yet approved'} />
        <Kpi label="New customers" value={String(d.newCust)} cur={d.newCust} prev={d.newCustPrev} note={range === 'all' ? users.length + ' in total' : undefined} />
      </div>

      <div className="dash-grid">
        <section className="panel span-8" aria-label={chartTitle}>
          <div className="panel-head">
            <div><div className="h3">{chartTitle}</div><div className="sub">Paid orders only · {money(d.revCur)} in total</div></div>
            <button type="button" className="btn-xs" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>{asTable ? 'Show chart' : 'View as table'}</button>
          </div>
          {d.buckets.every((b) => b.value === 0) ? (
            <div className="empty">No paid orders in this period yet.</div>
          ) : asTable ? (
            <table className="mini-table">
              <thead><tr><th>Period</th><th>Orders</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
              <tbody>{d.buckets.filter((b) => b.orders).map((b) => <tr key={b.from}><td>{b.label}</td><td>{b.orders}</td><td style={{ textAlign: 'right' }}>{money(b.value)}</td></tr>)}</tbody>
            </table>
          ) : (
            <>
              <div className={'cols' + (hover >= 0 ? ' dim' : '')} role="img" aria-label={chartTitle + '. Highest ' + money(top) + '.'} onMouseLeave={() => setHover(-1)}>
                {[0, 0.5, 1].map((f) => <div key={f} className="grid-line" style={{ bottom: f * 100 + '%' }}><span>{f === 0 ? '0' : compact(axis * f)}</span></div>)}
                <div className="bars">
                  {d.buckets.map((b, i) => (
                    <div key={b.from} className="slot" tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(-1)}>
                      {hover === i && <div className="tip"><b>{money(b.value)}</b>{b.label}<br />{b.orders} {b.orders === 1 ? 'order' : 'orders'}</div>}
                      <div className="bar" style={{ height: (b.value / axis) * 100 + '%' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="xaxis"><span>{d.buckets[0].label}</span><span>{d.buckets[Math.floor(d.buckets.length / 2)].label}</span><span>{d.buckets[d.buckets.length - 1].label}</span></div>
            </>
          )}
        </section>

        <section className="panel span-4">
          <div className="panel-head"><div><div className="h3">Orders by status</div><div className="sub">{rangeWord}</div></div></div>
          <HBars
            empty="No orders yet."
            rows={(Object.keys(d.status) as OrderStatus[]).map((s) => ({ key: s, label: s, value: d.status[s], text: String(d.status[s]), color: STATUS_STYLE[s].fg, dot: STATUS_STYLE[s].fg }))}
          />
        </section>

        <section className="panel span-6">
          <div className="panel-head"><div><div className="h3">Sales by type</div><div className="sub">Share of sales value, {rangeWord}</div></div></div>
          <HBars empty="No sales in this period." rows={topCats.map(([k, v]) => ({ key: k, label: k, value: v, text: money(v) + ' · ' + Math.round((v / catTotal) * 100) + '%' }))} />
        </section>

        <section className="panel span-6">
          <div className="panel-head"><div><div className="h3">Top candles</div><div className="sub">By units sold, {rangeWord}</div></div></div>
          <HBars empty="No sales in this period." rows={topProds.map(([k, v]) => ({ key: k, label: k, value: v.units, text: v.units + ' sold · ' + money(v.rev) }))} />
        </section>

        <section className="panel span-4">
          <div className="panel-head"><div><div className="h3">Payment methods</div><div className="sub">Orders, {rangeWord}</div></div></div>
          <HBars empty="No orders yet." rows={Object.entries(d.byPay).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v, text: String(v) }))} />
        </section>

        <section className="panel span-4">
          <div className="panel-head"><div><div className="h3">Stock to watch</div><div className="sub">5 or fewer left</div></div></div>
          {d.lows.length === 0 ? <div className="empty">Everything is well stocked.</div> : (
            <div className="list-rows">
              {d.lows.slice(0, 7).map((p) => (
                <div key={p.id}><span>{p.name}</span><span className="tag" style={p.stock === 0 ? { background: 'var(--a-bad-bg)', color: 'var(--a-bad)' } : { background: 'var(--a-warn-bg)', color: 'var(--a-warn)' }}>{p.stock === 0 ? '✕ Sold out' : p.stock + ' left'}</span></div>
              ))}
            </div>
          )}
        </section>

        <section className="panel span-4">
          <div className="panel-head"><div><div className="h3">Recent orders</div></div><a href="#/admin/orders" style={{ fontSize: 13 }}>View all</a></div>
          {recent.length === 0 ? <div className="empty">No orders yet.</div> : (
            <div className="list-rows">
              {recent.map((o) => (
                <div key={o.id}>
                  <button type="button" onClick={() => go('admin/orders?sel=' + o.id)} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    <b>{o.id}</b> · {o.name}<br /><span className="muted" style={{ fontSize: 12 }}>{fmtDate(o.date, { day: 'numeric', month: 'short' })} · {money(o.total)}</span>
                  </button>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}><StatusBadge status={o.status} /><PayBadge o={o} /></span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
