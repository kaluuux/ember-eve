import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Chip, ErrorText, Field, useForm } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { orderView } from '../commerce';
import { EMPTY, get, isEmail, money, set, useStored } from '../store';
import type { Order, User } from '../types';
import type { Route } from '../router';

type Tab = 'orders' | 'wish' | 'addr' | 'details';
const TABS: [Tab, string][] = [['orders', 'Orders'], ['wish', 'Saved'], ['addr', 'Address'], ['details', 'Details']];

export function Account({ route }: { route: Route }) {
  const { user, signOut, signIn, active, wish } = useApp();
  const orders = useStored<Order[]>('orders', EMPTY);
  const users = useStored<User[]>('users', EMPTY);
  const initial = (TABS.some(([k]) => k === route.q.tab) ? route.q.tab : 'orders') as Tab;
  const [tab, setTab] = useState<Tab>(initial);
  // header "Saved" link navigates here with ?tab=wish even when already on this page
  useEffect(() => { setTab(initial); }, [initial, route.q.tab]);
  const me = users.find((u) => u.id === user?.id);
  const { bind, str } = useForm({ ...(me?.address ?? {}), dname: user?.name ?? '', demail: user?.email ?? '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const myOrders = useMemo(
    () => (user ? orders.filter((o) => o.userId === user.id || o.email === user.email).reverse().map(orderView) : []),
    [orders, user],
  );

  if (!user) {
    return (
      <section className="narrow" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div className="card stack" style={{ gap: 12, alignItems: 'center' }}>
          <h1 className="h1">My Account</h1>
          <p className="muted" style={{ margin: 0 }}>Sign in to see orders, saved candles and addresses.</p>
          <a href="#/login?next=account" className="btn">Sign In</a>
          <a href="#/register" style={{ fontSize: 14 }}>Create account</a>
        </div>
      </section>
    );
  }

  const pick = (t: Tab) => { setTab(t); setErr(''); setOk(''); };

  const saveAddr = () => {
    if (!str('a1').trim() || !str('city').trim() || !str('post').trim()) { setOk(''); return setErr('Address, town and postcode are required.'); }
    set('users', get<User[]>('users', []).map((x) => (x.id === user.id ? { ...x, address: { first: str('first'), last: str('last'), phone: str('phone'), a1: str('a1'), a2: str('a2'), city: str('city'), post: str('post') } } : x)));
    setErr(''); setOk('Address saved.');
  };

  const saveDetails = () => {
    if (!str('dname').trim() || !isEmail(str('demail'))) { setOk(''); return setErr('Enter a name and a valid email.'); }
    if (str('newpw') && str('newpw').length < 8) { setOk(''); return setErr('New password must be at least 8 characters.'); }
    const name = str('dname').trim(), email = str('demail').trim();
    set('users', get<User[]>('users', []).map((x) => (x.id === user.id ? { ...x, name, email, password: str('newpw') || x.password } : x)));
    signIn({ id: user.id, name, email });
    setErr(''); setOk('Details saved.');
  };

  const f = (name: string, label: string, o: { type?: string; span?: 1 | 2 } = {}) => <Field key={name} label={label} {...bind(name)} type={o.type} span={o.span} />;

  return (
    <section className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 className="h1">Hi, {user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{user.email}</p>
        </div>
        <button type="button" className="btn ghost" onClick={signOut}>Sign Out</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map(([k, l]) => <Chip key={k} size="pill" on={tab === k} onClick={() => pick(k)}>{l}</Chip>)}
      </div>

      {tab === 'orders' && (
        <div className="stack" style={{ gap: 12 }}>
          {myOrders.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted" style={{ margin: '0 0 12px' }}>No orders yet.</p>
              <a href="#/shop" className="btn">Start Shopping</a>
            </div>
          )}
          {myOrders.map((o) => (
            <a key={o.id} href={'#/order/' + o.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', textDecoration: 'none', color: 'var(--ink)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{o.id}</div>
                <div className="muted">{o.dateL} · {o.count} items</div>
              </div>
              <span className="tag" style={{ background: o.statusBg, color: o.statusFg }}>{o.status}</span>
              <div style={{ fontWeight: 600 }}>{money(o.total)}</div>
            </a>
          ))}
        </div>
      )}

      {tab === 'wish' && (
        <>
          {wish.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted" style={{ margin: '0 0 12px' }}>Nothing saved yet.</p>
              <a href="#/shop" className="btn">Browse Candles</a>
            </div>
          )}
          <div className="pgrid">{active.filter((p) => wish.includes(p.id)).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>
      )}

      {tab === 'addr' && (
        <div className="card stack" style={{ maxWidth: 640, gap: 16 }}>
          <div className="h3">Saved address</div>
          <div className="fields two">
            {f('first', 'First name')}{f('last', 'Last name')}{f('phone', 'Phone', { type: 'tel', span: 2 })}
            {f('a1', 'Address', { span: 2 })}{f('a2', 'Flat, suite (optional)', { span: 2 })}{f('city', 'Town or city')}{f('post', 'Postcode')}
          </div>
          <ErrorText>{err}</ErrorText>{ok && <div className="ok">{ok}</div>}
          <div><button type="button" className="btn" onClick={saveAddr}>Save Address</button></div>
        </div>
      )}

      {tab === 'details' && (
        <div className="card stack" style={{ maxWidth: 640, gap: 16 }}>
          <div className="h3">Your details</div>
          <div className="fields two">
            {f('dname', 'Full name', { span: 2 })}{f('demail', 'Email', { type: 'email', span: 2 })}{f('newpw', 'New password (optional)', { type: 'password', span: 2 })}
          </div>
          <ErrorText>{err}</ErrorText>{ok && <div className="ok">{ok}</div>}
          <div><button type="button" className="btn" onClick={saveDetails}>Save Details</button></div>
        </div>
      )}
    </section>
  );
}
