import { useState, type ReactNode } from 'react';
import { EMPTY, STATUS_COLORS, DEFAULT_SETTINGS, fmtDate, get, money, set, useStored } from '../store';
import { Chip, ErrorText, Field, useForm } from '../components/ui';
import { go } from '../router';
import type { Discount, Message, Order, OrderStatus, Product, Review, Settings, User } from '../types';
import { orderView } from '../commerce';

type Flash = (m: string) => void;

const H1 = ({ children }: { children: ReactNode }) => <h1 className="h1" style={{ marginBottom: 16 }}>{children}</h1>;
const Status = ({ status }: { status: OrderStatus }) => {
  const [bg, fg] = STATUS_COLORS[status] ?? STATUS_COLORS.Processing;
  return <span className="tag" style={{ background: bg, color: fg }}>{status}</span>;
};

/* ------------------------------------------------------------------ Dashboard */
export function Dashboard() {
  const orders = useStored<Order[]>('orders', EMPTY);
  const products = useStored<Product[]>('products', EMPTY);
  const users = useStored<User[]>('users', EMPTY);

  const live = orders.filter((o) => o.status !== 'Cancelled');
  const rev = live.reduce((a, o) => a + o.total, 0);
  const pending = orders.filter((o) => o.status === 'Processing').length;
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { key: d.toDateString(), d: d.toLocaleDateString('en-GB', { weekday: 'short' }) };
  });
  const dv = days.map((d) => ({ d: d.d, v: live.filter((o) => new Date(o.date).toDateString() === d.key).reduce((a, o) => a + o.total, 0) }));
  const mx = Math.max(1, ...dv.map((x) => x.v));
  const lows: { name: string; stock: string; color: string }[] = [];
  products.forEach((p) => {
    if (p.stock !== null && p.stock <= 5) lows.push({ name: p.name, stock: p.stock === 0 ? 'Sold out' : p.stock + ' left', color: p.stock === 0 ? 'var(--red)' : 'var(--amber)' });
  });
  const units: Record<string, number> = {};
  live.forEach((o) => o.items.forEach((i) => { const k = i.name.split(',')[0]; units[k] = (units[k] || 0) + i.qty; }));
  const top = Object.keys(units).sort((a, b) => units[b] - units[a]).slice(0, 5);
  const kpis = [
    { l: 'Revenue', v: money(rev), s: 'excluding cancelled' },
    { l: 'Orders', v: String(orders.length), s: pending + ' to process' },
    { l: 'Average order', v: money(live.length ? rev / live.length : 0), s: 'per order' },
    { l: 'Customers', v: String(users.length), s: 'registered' },
  ];
  const row = { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: '1px solid rgba(60,30,10,0.08)' } as const;

  return (
    <>
      <H1>Dashboard</H1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.l} className="card" style={{ padding: 16 }}>
            <div className="muted">{k.l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{k.s}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="h3" style={{ marginBottom: 16 }}>Revenue, last 7 days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {dv.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.v ? money(b.v) : ''}</div>
                <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: 'var(--brown)', height: Math.max(2, Math.round((b.v / mx) * 110)) }} />
                <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{b.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="h3" style={{ marginBottom: 12 }}>Low stock</div>
          {lows.length === 0 && <div className="muted">Everything is well stocked.</div>}
          {lows.map((l, i) => <div key={i} style={row}><span>{l.name}</span><span style={{ fontWeight: 600, color: l.color }}>{l.stock}</span></div>)}
        </div>
        <div className="card">
          <div className="h3" style={{ marginBottom: 12 }}>Top sellers</div>
          {top.map((k) => <div key={k} style={row}><span>{k}</span><span style={{ fontWeight: 600 }}>{units[k]} sold</span></div>)}
        </div>
        <div className="card">
          <div className="h3" style={{ marginBottom: 12 }}>Recent orders</div>
          {orders.slice(-5).reverse().map((o) => (
            <button key={o.id} type="button" onClick={() => go('admin/orders?sel=' + o.id)} style={{ ...row, width: '100%', gap: 8, font: '400 14px Inter', border: 'none', borderBottom: row.borderBottom, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span>{o.id} · {o.name}</span><span style={{ fontWeight: 600 }}>{money(o.total)}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------------- Orders */
const STATUS_FILTERS = ['All', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'] as const;

export function OrdersView({ sel, flash }: { sel: string; flash: Flash }) {
  const orders = useStored<Order[]>('orders', EMPTY);
  const [fil, setFil] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();
  const rows = orders.slice().reverse().filter((o) => (fil === 'All' || o.status === fil) && (!q || (o.id + o.name + o.email).toLowerCase().includes(q)));
  const selO = orders.find((o) => o.id === sel);
  const ord = selO ? orderView(selO) : null;

  const setStatus = (id: string, st: OrderStatus) => {
    const list = get<Order[]>('orders', []), products = get<Product[]>('products', []), iso = new Date().toISOString();
    const o = list.find((x) => x.id === id);
    if (!o) return;
    if (st === 'Cancelled') {
      o.items.forEach((i) => {
        if (!i.pid) return;
        const p = products.find((x) => x.id === i.pid);
        if (p && p.stock !== null) p.stock += i.qty;
      });
    }
    o.status = st;
    o.log = (o.log || []).concat({ s: st, d: iso });
    set('orders', list); set('products', products);
    flash('Order ' + id + ': ' + st);
  };
  const next = selO ? ({ Processing: 'Dispatched', Dispatched: 'Delivered' } as Partial<Record<OrderStatus, OrderStatus>>)[selO.status] : undefined;
  const canCancel = selO && (selO.status === 'Processing' || selO.status === 'Dispatched');

  return (
    <>
      <H1>Orders</H1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {STATUS_FILTERS.map((c) => <Chip key={c} size="pill" on={fil === c} onClick={() => setFil(c)}>{c}</Chip>)}
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, name, email" aria-label="Search orders" style={{ width: 260, padding: '8px 12px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: ord ? 'repeat(auto-fit,minmax(320px,1fr))' : '1fr', gap: 16, alignItems: 'start' }}>
        <div className="card flush" style={{ overflowX: 'auto', gridColumn: ord ? 'span 2' : undefined }}>
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="click" onClick={() => go('admin/orders?sel=' + o.id)} style={{ background: sel === o.id ? 'var(--cream)' : undefined }}>
                  <td style={{ fontWeight: 600 }}>{o.id}</td>
                  <td>{fmtDate(o.date, { day: 'numeric', month: 'short' })}</td>
                  <td>{o.name}<div style={{ fontSize: 12, color: 'var(--muted2)' }}>{o.email}</div></td>
                  <td>{money(o.total)}</td>
                  <td><Status status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="muted" style={{ padding: 24 }}>No orders match.</div>}
        </div>
        {ord && (
          <aside className="card stack" style={{ gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="h3">{ord.id}</div>
              <button type="button" onClick={() => go('admin/orders')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', font: '500 14px Inter' }}>Close</button>
            </div>
            <span style={{ alignSelf: 'flex-start' }}><Status status={ord.status} /></span>
            <div><b>{ord.name}</b><br />{ord.email}<br />{ord.phone}</div>
            <div><b>Deliver to</b><br />{ord.addr}</div>
            <div><b>Delivery</b> {ord.shipName} · <b>Payment</b> {ord.pay}</div>
            {ord.note && <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '8px 12px' }}><b>Gift note</b><br />{ord.note}</div>}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              {ord.items.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                  <span>{l.qty} × {l.name}<br /><span style={{ fontSize: 12, color: 'var(--muted2)' }}>{l.sub}</span></span>
                  <span>{money(l.unit * l.qty)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery</span><span>{ord.shipL}</span></div>
            {ord.wrap > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gift wrap</span><span>{money(ord.wrap)}</span></div>}
            {ord.disc > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>Discount {ord.code}</span><span>-{money(ord.disc)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}><span>Total</span><span>{money(ord.total)}</span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {next && <button type="button" className="btn sm" onClick={() => setStatus(ord.id, next)}>Mark {next}</button>}
              {canCancel && <button type="button" className="btn sm ghost danger" onClick={() => setStatus(ord.id, 'Cancelled')}>Cancel Order</button>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
              {(ord.log || []).map((g, i) => <div key={i}>{g.s} · {new Date(g.d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>)}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Customers */
export function Customers() {
  const users = useStored<User[]>('users', EMPTY);
  const orders = useStored<Order[]>('orders', EMPTY);
  const live = orders.filter((o) => o.status !== 'Cancelled');
  return (
    <>
      <H1>Customers</H1>
      <div className="card flush" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th><th>Spent</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const os = live.filter((o) => o.userId === u.id || o.email === u.email);
              return <tr key={u.id}><td style={{ fontWeight: 600 }}>{u.name}</td><td>{u.email}</td><td>{u.joined}</td><td>{os.length}</td><td>{money(os.reduce((a, o) => a + o.total, 0))}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Discounts */
export function Discounts({ flash }: { flash: Flash }) {
  const disc = useStored<Discount[]>('discounts', EMPTY);
  const { bind, str, setF } = useForm();
  const [dtype, setDtype] = useState<Discount['type']>('pct');
  const [err, setErr] = useState('');

  const add = () => {
    const code = str('dcode').trim().toUpperCase(), val = Number(str('dval') || 0);
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return setErr('Code must be 3 to 20 letters or numbers.');
    if (disc.some((x) => x.code === code)) return setErr('That code already exists.');
    if (dtype !== 'ship' && !(val > 0)) return setErr('Enter a value above 0.');
    if (dtype === 'pct' && val > 100) return setErr('Percentage cannot exceed 100.');
    set('discounts', disc.concat({ code, type: dtype, value: val, min: Number(str('dmin') || 0), active: true }));
    setF({}); setErr(''); flash('Code added');
  };
  const offer = (d: Discount) => (d.type === 'pct' ? d.value + '% off' + (d.min ? ' over ' + money(d.min) : '') : d.type === 'fixed' ? money(d.value) + ' off' + (d.min ? ' over ' + money(d.min) : '') : 'Free standard delivery');

  return (
    <>
      <H1>Discount Codes</H1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card flush" style={{ overflowX: 'auto', gridColumn: 'span 2' }}>
          <table className="table">
            <thead><tr><th>Code</th><th>Offer</th><th>Status</th><th /></tr></thead>
            <tbody>
              {disc.map((d) => (
                <tr key={d.code}>
                  <td style={{ fontWeight: 600 }}>{d.code}</td>
                  <td>{offer(d)}</td>
                  <td><button type="button" className="tag" onClick={() => set('discounts', disc.map((x) => (x.code === d.code ? { ...x, active: !x.active } : x)))} style={{ border: 'none', cursor: 'pointer', background: d.active ? '#DCFCE7' : 'var(--sand-l)', color: d.active ? '#166534' : 'var(--muted)' }}>{d.active ? 'Active' : 'Paused'}</button></td>
                  <td style={{ textAlign: 'right' }}><button type="button" className="btn-xs danger" onClick={() => set('discounts', disc.filter((x) => x.code !== d.code))}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="card stack" style={{ gap: 12 }} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="h3">New code</div>
          <div className="fields one">
            <Field label="Code" {...bind('dcode')} placeholder="SUMMER15" />
            <Field label="Value (% or Rs)" type="number" {...bind('dval')} />
            <Field label="Minimum spend (Rs)" type="number" {...bind('dmin')} />
          </div>
          <select className="input" value={dtype} onChange={(e) => setDtype(e.target.value as Discount['type'])} aria-label="Discount type">
            <option value="pct">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
            <option value="ship">Free standard delivery</option>
          </select>
          <ErrorText>{err}</ErrorText>
          <button type="submit" className="btn" onClick={add}>Add Code</button>
        </form>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- Reviews */
export function ReviewsView() {
  const reviews = useStored<Review[]>('reviews', EMPTY);
  const products = useStored<Product[]>('products', EMPTY);
  const pname = (id: number) => products.find((p) => p.id === id)?.name ?? 'Removed';
  return (
    <>
      <H1>Reviews</H1>
      {reviews.length === 0 && <div className="muted">No reviews.</div>}
      <div className="stack" style={{ gap: 12 }}>
        {reviews.slice().reverse().map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{pname(r.pid)} · {r.stars} / 5 · {r.who} · {r.date}</div>
              <div style={{ fontSize: 16, lineHeight: '24px' }}>{r.q}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="tag" style={{ background: r.approved ? '#DCFCE7' : '#FEF3C7', color: r.approved ? '#166534' : '#8A4B00' }}>{r.approved ? 'Published' : 'Pending'}</span>
              <button type="button" className="btn-xs" onClick={() => set('reviews', reviews.map((x) => (x.id === r.id ? { ...x, approved: !x.approved } : x)))}>{r.approved ? 'Unpublish' : 'Approve'}</button>
              <button type="button" className="btn-xs danger" onClick={() => set('reviews', reviews.filter((x) => x.id !== r.id))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- Messages */
export function Messages() {
  const msgs = useStored<Message[]>('messages', EMPTY);
  return (
    <>
      <H1>Messages</H1>
      {msgs.length === 0 && <div className="muted">No messages yet.</div>}
      <div className="stack" style={{ gap: 12 }}>
        {msgs.slice().reverse().map((m) => (
          <div key={m.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name} <span style={{ fontWeight: 400, color: 'var(--muted2)' }}>{m.email} · {fmtDate(m.date, { day: 'numeric', month: 'short' })}</span></div>
              <div style={{ fontSize: 16, lineHeight: '24px', marginTop: 4 }}>{m.text}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <button type="button" className="btn-xs" style={{ background: m.read ? '#fff' : 'var(--cream)' }} onClick={() => set('messages', msgs.map((y) => (y.id === m.id ? { ...y, read: !y.read } : y)))}>{m.read ? 'Mark unread' : 'Mark read'}</button>
              <button type="button" className="btn-xs danger" onClick={() => set('messages', msgs.filter((y) => y.id !== m.id))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- Settings */
export function SettingsView() {
  const st = useStored<Settings>('settings', DEFAULT_SETTINGS);
  const { bind, str, setF } = useForm({ sshop: st.shop, semail: st.email, sstd: st.standard, sexp: st.express, sfree: st.freeOver, swrap: st.giftWrap, sfc: st.freeColors, sxc: st.extraColorFee, sbox: st.giftBoxFee });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const save = () => {
    const n: Settings = { shop: str('sshop'), email: str('semail'), standard: Number(str('sstd')), express: Number(str('sexp')), freeOver: Number(str('sfree')), giftWrap: Number(str('swrap')), freeColors: Number(str('sfc')), extraColorFee: Number(str('sxc')), giftBoxFee: Number(str('sbox')) };
    if ([n.standard, n.express, n.freeOver, n.giftWrap, n.freeColors, n.extraColorFee, n.giftBoxFee].some((x) => isNaN(x) || x < 0) || [str('sstd'), str('sexp'), str('sfree'), str('swrap'), str('sfc'), str('sxc'), str('sbox')].some((x) => x === '')) { setOk(''); return setErr('Delivery values must be numbers of 0 or more.'); }
    if (str('spw') && str('spw').length < 8) { setOk(''); return setErr('Password must be at least 8 characters.'); }
    set('settings', n);
    if (str('spw')) set('adminpw', str('spw'));
    setF({ sshop: n.shop, semail: n.email, sstd: n.standard, sexp: n.express, sfree: n.freeOver, swrap: n.giftWrap, sfc: n.freeColors, sxc: n.extraColorFee, sbox: n.giftBoxFee });
    setErr(''); setOk('Settings saved.');
  };

  return (
    <>
      <H1>Settings</H1>
      <form className="card stack" style={{ maxWidth: 560, gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="h3">Store and delivery</div>
        <div className="fields two">
          <Field label="Shop name" {...bind('sshop')} />
          <Field label="Contact email" type="email" {...bind('semail')} />
          <Field label="Standard delivery (Rs)" type="number" {...bind('sstd')} />
          <Field label="Express delivery (Rs)" type="number" {...bind('sexp')} />
          <Field label="Free delivery over (Rs)" type="number" {...bind('sfree')} />
          <Field label="Gift wrap (Rs)" type="number" {...bind('swrap')} />
          <Field label="Gift box fee (Rs)" type="number" {...bind('sbox')} />
          <Field label="Free colours in a blend" type="number" {...bind('sfc')} />
          <Field label="Fee per extra colour (Rs)" type="number" {...bind('sxc')} />
          <Field label="New admin password (optional)" type="password" {...bind('spw')} span={2} autoComplete="new-password" />
        </div>
        <ErrorText>{err}</ErrorText>
        {ok && <div className="ok">{ok}</div>}
        <div><button type="submit" className="btn" onClick={save}>Save Settings</button></div>
      </form>
    </>
  );
}
