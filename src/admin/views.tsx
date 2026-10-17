import { useMemo, useState, type ReactNode } from 'react';
import { EMPTY, addressBook, fmtDate, get, money, set, useStored } from '../store';
import { PageHead, StatusBadge, downloadCsv, waLink } from './ui';
import { Chip, ErrorText, Field, useForm } from '../components/ui';
import type { Discount, Message, Order, Product, Review, User } from '../types';

type Flash = (m: string) => void;

const H1 = ({ children }: { children: ReactNode }) => <PageHead title={String(children)} />;

/* ------------------------------------------------------------------ Customers */
export function Customers() {
  const users = useStored<User[]>('users', EMPTY);
  const orders = useStored<Order[]>('orders', EMPTY);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');

  // registered accounts plus guests who only ever checked out
  const rows = useMemo(() => {
    const live = orders.filter((o) => o.status !== 'Cancelled');
    const byEmail = new Map<string, { name: string; email: string; phone: string; since: string; account: boolean; user?: User; all: Order[]; os: Order[] }>();
    users.forEach((u) => byEmail.set(u.email.toLowerCase(), { name: u.name, email: u.email, phone: u.phone || u.address?.phone || '', since: u.joined, account: true, user: u, all: [], os: [] }));
    orders.forEach((o) => {
      const k = o.email.toLowerCase();
      const c = byEmail.get(k) ?? { name: o.name, email: o.email, phone: o.phone, since: o.date.slice(0, 10), account: false, all: [], os: [] };
      if (!c.phone) c.phone = o.phone;
      c.all.push(o);
      byEmail.set(k, c);
    });
    live.forEach((o) => byEmail.get(o.email.toLowerCase())?.os.push(o));
    return [...byEmail.values()].map((c) => ({ ...c, spent: c.os.reduce((a, o) => a + o.total, 0) })).sort((a, b) => b.spent - a.spent);
  }, [users, orders]);

  const shown = rows.filter((c) => !q || (c.name + c.email + c.phone).toLowerCase().includes(q.toLowerCase()));
  const cur = rows.find((c) => c.email.toLowerCase() === sel);
  const exportCsv = () => downloadCsv('customers', [['Name', 'Email', 'Phone', 'Account', 'Customer since', 'Orders', 'Total spent'], ...shown.map((c) => [c.name, c.email, c.phone, c.account ? 'Yes' : 'Guest', c.since, c.os.length, c.spent])]);

  return (
    <>
      <PageHead title="Customers" sub={rows.length + ' customers, ' + rows.filter((c) => c.account).length + ' with accounts'} actions={<button type="button" className="btn ghost sm" onClick={exportCsv}>Export CSV</button>} />
      <div className="filters"><input className="input" style={{ width: 300 }} placeholder="Search name, email, phone" aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className={'orders-layout' + (cur ? ' open' : '')}>
        <div className="card flush" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Name</th><th>Contact</th><th>Since</th><th>Orders</th><th style={{ textAlign: 'right' }}>Spent</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.email} className={'click' + (cur?.email === c.email ? ' sel' : '')} onClick={() => setSel(c.email.toLowerCase())}>
                  <td style={{ fontWeight: 600 }}>{c.name}{!c.account && <span className="tagpill" style={{ marginLeft: 8 }}>Guest</span>}</td>
                  <td>{c.email}<div className="muted" style={{ fontSize: 12 }}>{c.phone}</div></td>
                  <td>{c.since}</td><td>{c.os.length}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(c.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <div className="empty">No customers yet.</div>}
        </div>
        {cur && (
          <aside className="panel detail" aria-label={'Customer ' + cur.name}>
            <div className="row-between">
              <div><div className="h3" style={{ fontSize: 20 }}>{cur.name}</div><div className="muted" style={{ fontSize: 12 }}>{cur.account ? 'Account since ' + cur.since : 'Guest customer, first order ' + cur.since}</div></div>
              <button type="button" className="btn-xs" onClick={() => setSel('')}>Close</button>
            </div>
            <div className="block">
              <h4>Contact</h4>
              {cur.email}<br />{cur.phone}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {cur.phone && <a className="btn-xs" href={waLink(cur.phone, 'Hi ' + cur.name.split(' ')[0] + ', this is Ember & Eve. ')} target="_blank" rel="noreferrer">WhatsApp</a>}
                {cur.phone && <a className="btn-xs" href={'tel:' + cur.phone}>Call</a>}
                <a className="btn-xs" href={'mailto:' + cur.email}>Email</a>
              </div>
            </div>
            <div className="block">
              <h4>Totals</h4>
              <div className="row-between"><span>Orders</span><b>{cur.os.length}</b></div>
              <div className="row-between"><span>Total spent</span><b>{money(cur.spent)}</b></div>
              <div className="row-between"><span>Average order</span><b>{money(cur.os.length ? cur.spent / cur.os.length : 0)}</b></div>
            </div>
            <div className="block">
              <h4>Saved addresses</h4>
              {addressBook(cur.user).length === 0 ? <span className="muted">None saved.</span> : addressBook(cur.user).map((a) => (
                <div key={a.id} style={{ padding: '4px 0' }}><b>{a.label}</b>{a.isDefault && <span className="tagpill" style={{ marginLeft: 6 }}>Default</span>}<br />{a.name} · {a.phone}<br /><span className="muted">{[a.a1, a.a2, a.city, a.district].filter(Boolean).join(', ')}</span></div>
              ))}
            </div>
            <div className="block">
              <h4>Orders</h4>
              {cur.all.length === 0 ? <span className="muted">No orders yet.</span> : cur.all.slice().sort((a, b) => b.date.localeCompare(a.date)).map((o) => (
                <a key={o.id} href={'#/admin/orders?sel=' + o.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--a-line-soft)', textDecoration: 'none', color: 'inherit', gap: 8 }}>
                  <span><b>{o.id}</b> · {fmtDate(o.date, { day: 'numeric', month: 'short' })}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><StatusBadge status={o.status} /><b>{money(o.total)}</b></span>
                </a>
              ))}
            </div>
          </aside>
        )}
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
