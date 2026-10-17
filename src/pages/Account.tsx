import { useEffect, useMemo, useState } from 'react';
import { tr } from '../i18n';
import { Rewards } from '../components/Rewards';
import { useApp } from '../AppContext';
import { Chip, ErrorText, Field, useForm } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { orderView } from '../commerce';
import { EMPTY, SL_DISTRICTS, addressBook, get, isEmail, money, set, useStored } from '../store';
import { remote } from '../remote';
import { saveProfile, updatePassword } from '../sync';
import { go } from '../router';
import type { Order, SavedAddress, User } from '../types';
import type { Route } from '../router';
import { useT } from '../i18n';

type Tab = 'orders' | 'addr' | 'wish' | 'rewards' | 'details';
const TABS: [Tab, string][] = [['orders', 'Orders'], ['addr', 'Addresses'], ['wish', 'Saved'], ['rewards', 'Rewards'], ['details', 'Profile']];
const payWord = (p: Order['payStatus']) => ({ Pending: ['Awaiting payment', '#FEF3C7', '#8A4B00'], 'Receipt sent': ['Receipt received', '#DBEAFE', '#1E40AF'], Failed: ['Payment issue', '#FEE2E2', '#991B1B'], Paid: ['Paid', '#DCFCE7', '#166534'] } as const)[p ?? 'Paid'];
const blank = (name = '', phone = ''): SavedAddress => ({ id: '', label: '', name, phone, a1: '', a2: '', city: '', district: '', post: '', isDefault: false });

export function Account({ route }: { route: Route }) {
  const t = useT();
  const { user, signOut, active, wish, reorder, flash } = useApp();
  const orders = useStored<Order[]>('orders', EMPTY);
  const users = useStored<User[]>('users', EMPTY);
  const initial = (TABS.some(([k]) => k === route.q.tab) ? route.q.tab : 'orders') as Tab;
  const [tab, setTab] = useState<Tab>(initial);
  useEffect(() => { setTab(initial); }, [initial, route.q.tab]);

  const me = users.find((u) => u.id === user?.id);
  const book = useMemo(() => addressBook(me), [me]);

  const mine = useMemo(
    () => (user ? orders.filter((o) => o.userId === user.id || o.email.toLowerCase() === user.email.toLowerCase()).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [orders, user],
  );
  const live = mine.filter((o) => o.status !== 'Cancelled');
  const current = mine.filter((o) => o.status === 'Processing' || o.status === 'Dispatched');
  const past = mine.filter((o) => o.status === 'Delivered' || o.status === 'Cancelled');
  const spent = live.reduce((a, o) => a + (o.due ?? o.total), 0);

  if (!user) {
    return (
      <section className="narrow" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div className="card stack" style={{ gap: 12, alignItems: 'center' }}>
          <h1 className="h1">{t('My Account')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('Sign in to see your orders, saved addresses and favourites.')}</p>
          <a href="/login?next=account" className="btn">{t('Sign In')}</a>
          <a href="/register" style={{ fontSize: 14 }}>{t('Create account')}</a>
          <a href="/track" style={{ fontSize: 14 }}>{t('Track an order without signing in')}</a>
        </div>
      </section>
    );
  }

  const buyAgain = (o: Order) => {
    const n = reorder(o);
    if (n > 0) { flash(tr(n === 1 ? '{n} item added to your basket' : '{n} items added to your basket', { n })); go('cart'); return; }
    const first = o.items.find((i) => i.pid);
    go(first ? 'product/' + first.pid : 'shop');
  };

  const stats: [string, string, string][] = [
    ['Total orders', String(live.length), mine.length - live.length ? t('{n} cancelled', { n: mine.length - live.length }) : 'all time'],
    ['In progress', String(current.length), current.length ? 'on their way to you' : 'nothing pending'],
    ['Total spent', money(spent), 'excluding cancelled'],
    ['Saved addresses', String(book.length), book.length ? 'ready for checkout' : 'add one for faster checkout'],
  ];

  return (
    <section className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 className="h1">{t('Hi,')}{' '}{user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{user.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/track" className="btn ghost sm">{t('Track an order')}</a>
          <button type="button" className="btn ghost sm" onClick={signOut}>{t('Sign Out')}</button>
        </div>
      </div>

      <div className="acct-stats">
        {stats.map(([l, v, s]) => (
          <div key={l} className="card acct-stat"><div className="muted">{t(l)}</div><div className="v">{v}</div><div className="muted" style={{ fontSize: 12 }}>{t(s)}</div></div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '24px 0' }}>
        {TABS.map(([k, l]) => <Chip key={k} size="pill" on={tab === k} onClick={() => { setTab(k); go('account?tab=' + k); }}>{t(l)}</Chip>)}
      </div>

      {tab === 'orders' && (
        <div className="stack" style={{ gap: 28 }}>
          {mine.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted" style={{ margin: '0 0 12px' }}>{t('No orders yet. Orders you place while signed in, or with this email, appear here.')}</p>
              <a href="/shop" className="btn">{t('Start Shopping')}</a>
            </div>
          )}
          {current.length > 0 && <OrderList title={t('Current orders')} list={current} onAgain={buyAgain} />}
          {past.length > 0 && <OrderList title={t('Past orders')} list={past} onAgain={buyAgain} />}
        </div>
      )}

      {tab === 'addr' && <Addresses book={book} me={me} />}

      {tab === 'wish' && (
        <>
          {wish.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted" style={{ margin: '0 0 12px' }}>{t('Nothing saved yet.')}</p>
              <a href="/shop" className="btn">{t('Browse Candles')}</a>
            </div>
          )}
          <div className="pgrid">{active.filter((p) => wish.includes(p.id)).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>
      )}

      {tab === 'rewards' && <Rewards />}

      {tab === 'details' && <Profile me={me} />}
    </section>
  );
}

function OrderList({ title, list, onAgain }: { title: string; list: Order[]; onAgain: (o: Order) => void }) {
  const t = useT();
  return (
    <div className="stack" style={{ gap: 12 }}>
      <h2 className="h3">{t(title)} <span className="muted" style={{ fontWeight: 400 }}>({list.length})</span></h2>
      {list.map((raw) => {
        const o = orderView(raw);
        const [pl, pbg, pfg] = payWord(raw.payStatus);
        const names = o.items.slice(0, 2).map((i) => i.name).join(', ') + (o.items.length > 2 ? ' +' + (o.items.length - 2) + ' more' : '');
        return (
          <div key={o.id} className="card order-row">
            <div className="swatches-row" aria-hidden="true">{o.items.slice(0, 3).map((i, k) => <span key={k} style={{ background: i.tint }} />)}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600 }}>{o.id} <span className="muted" style={{ fontWeight: 400 }}>· {o.dateL}</span></div>
              <div className="muted">{names}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <span className="tag" style={{ background: o.statusBg, color: o.statusFg }}>{o.status}</span>
                <span className="tag" style={{ background: pbg, color: pfg }}>{pl}</span>
                {raw.tracking?.number && <span className="tag" style={{ background: 'var(--cream)', color: 'var(--text2)' }}>{raw.tracking.courier} {raw.tracking.number}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{money(o.total)}</div>
              <div className="muted">{o.count} {o.count === 1 ? t('item') : t('items')}</div>
            </div>
            <div className="order-actions">
              <a className="btn-xs" href={'/order/' + o.id}>{raw.payStatus === 'Pending' && raw.payMethod === 'bank' ? t('Pay / upload receipt') : t('View')}</a>
              <a className="btn-xs" href={'/invoice/' + o.id}>{t('Invoice')}</a>
              <button type="button" className="btn-xs" onClick={() => onAgain(raw)}>{t('Buy again')}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Addresses({ book, me }: { book: SavedAddress[]; me: User | undefined }) {
  const t = useT();
  const { flash } = useApp();
  const [edit, setEdit] = useState<SavedAddress | null>(null);
  const [err, setErr] = useState('');
  const { bind, str, set: patch, setF } = useForm();

  const persist = async (next: SavedAddress[]) => {
    const list = next.length && !next.some((a) => a.isDefault) ? next.map((a, i) => ({ ...a, isDefault: i === 0 })) : next;
    if (remote) {
      const e = await saveProfile({ addresses: list });
      if (e) { flash(e); return false; }
    } else if (me) {
      set('users', get<User[]>('users', []).map((u) => (u.id === me.id ? { ...u, addresses: list } : u)));
    }
    return true;
  };

  const open = (a: SavedAddress) => {
    setEdit(a); setErr('');
    setF({ label: a.label, name: a.name, phone: a.phone, a1: a.a1, a2: a.a2, city: a.city, district: a.district, post: a.post });
  };
  const save = async () => {
    if (!str('name').trim() || !/^[+\d][\d\s-]{8,}$/.test(str('phone').trim())) return setErr('Enter the recipient name and a phone number.');
    for (const [k, msg] of [['a1', 'Enter the address.'], ['city', 'Enter the town or city.'], ['district', 'Enter the district.']] as const) if (!str(k).trim()) return setErr(msg);
    const entry: SavedAddress = { id: edit?.id || 'a' + Date.now().toString(36), label: str('label').trim() || 'Address', name: str('name').trim(), phone: str('phone').trim(), a1: str('a1').trim(), a2: str('a2').trim(), city: str('city').trim(), district: str('district'), post: str('post').trim(), isDefault: edit?.isDefault ?? book.length === 0 };
    const next = edit?.id ? book.map((a) => (a.id === edit.id ? entry : a)) : book.concat(entry);
    if (await persist(next)) { setEdit(null); flash('Address saved'); }
  };
  const makeDefault = async (id: string) => { if (await persist(book.map((a) => ({ ...a, isDefault: a.id === id })))) flash('Default address updated'); };
  const remove = async (id: string) => { if (await persist(book.filter((a) => a.id !== id))) flash('Address removed'); };

  return (
    <div className="stack" style={{ gap: 16 }}>
      {!edit && (
        <>
          <div className="row-between"><h2 className="h3">{t('Saved addresses')}</h2><button type="button" className="btn sm" onClick={() => open(blank(me?.name ?? '', me?.phone ?? ''))}>{t('Add address')}</button></div>
          {book.length === 0 && <div className="card" style={{ textAlign: 'center' }}><p className="muted" style={{ margin: 0 }}>{t('No saved addresses yet. Add one and pick it at checkout instead of typing it again.')}</p></div>}
          <div className="addr-pick">
            {book.map((a) => (
              <div key={a.id} className="addr-card" style={{ cursor: 'default' }}>
                <div><b>{a.label || t('Address')}</b>{a.isDefault && <span className="tagpill" style={{ marginLeft: 8 }}>{t('Default')}</span>}</div>
                <span>{a.name}</span>
                <span>{a.phone}</span>
                <span>{[a.a1, a.a2, a.city, a.district, a.post].filter(Boolean).join(', ')}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button type="button" className="btn-xs" onClick={() => open(a)}>{t('Edit')}</button>
                  {!a.isDefault && <button type="button" className="btn-xs" onClick={() => makeDefault(a.id)}>{t('Make default')}</button>}
                  <button type="button" className="btn-xs danger" onClick={() => remove(a.id)}>{t('Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {edit && (
        <div className="card stack" style={{ maxWidth: 680, gap: 16 }}>
          <div className="h3">{edit.id ? t('Edit address') : t('New address')}</div>
          <div className="fields two">
            <Field label={t('Label (e.g. Home, Work)')} {...bind('label')} />
            <Field label={t('Recipient name')} {...bind('name')} />
            <Field label={t('Phone / WhatsApp')} type="tel" {...bind('phone')} span={2} />
            <Field label={t('Address')} {...bind('a1')} span={2} />
            <Field label={t('Apartment, landmark (optional)')} {...bind('a2')} span={2} />
            <Field label={t('Town or city')} {...bind('city')} />
            <label className="field">{t('District')}
              <select className="input" name="district" value={str('district')} onChange={(e) => patch({ district: e.target.value })}>
                <option value="">{t('Select district')}</option>
                {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <Field label={t('Postal code (optional)')} {...bind('post')} span={2} />
          </div>
          <ErrorText>{err}</ErrorText>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn" onClick={save}>{t('Save address')}</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>{t('Cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Profile({ me }: { me: User | undefined }) {
  const t = useT();
  const { user, signIn } = useApp();
  const { bind, str } = useForm({ dname: user?.name ?? '', dphone: me?.phone ?? '', demail: user?.email ?? '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const save = async () => {
    if (!str('dname').trim() || !isEmail(str('demail'))) { setOk(''); return setErr('Enter a name and a valid email.'); }
    if (str('newpw') && str('newpw').length < 8) { setOk(''); return setErr('New password must be at least 8 characters.'); }
    const name = str('dname').trim(), phone = str('dphone').trim(), email = str('demail').trim();
    if (remote) {
      let e = await saveProfile({ name, phone });
      if (!e && str('newpw')) e = await updatePassword(str('newpw'));
      if (e) { setOk(''); return setErr(e); }
    } else if (user) {
      set('users', get<User[]>('users', []).map((x) => (x.id === user.id ? { ...x, name, email, phone, password: str('newpw') || x.password } : x)));
      signIn({ id: user.id, name, email });
    }
    setErr(''); setOk('Profile saved.');
  };

  return (
    <div className="card stack" style={{ maxWidth: 640, gap: 16 }}>
      <div className="h3">{t('Your details')}</div>
      <div className="fields two">
        <Field label={t('Full name')} {...bind('dname')} span={2} />
        <Field label={t('Mobile number')} type="tel" {...bind('dphone')} span={2} />
        <Field label={remote ? t('Email (sign-in email, contact us to change it)') : t('Email')} type="email" {...bind('demail')} span={2} />
        <Field label={t('New password (optional)')} type="password" {...bind('newpw')} span={2} autoComplete="new-password" />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{t('Signed in with Google? You can set a password here to also sign in with your email.')}</div>
      <ErrorText>{err}</ErrorText>{ok && <div className="ok">{ok}</div>}
      <div><button type="button" className="btn" onClick={save}>{t('Save Profile')}</button></div>
    </div>
  );
}
