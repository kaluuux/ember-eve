import { useEffect, useState } from 'react';
import './admin.css';
import { Icon } from './ui';
import { EMPTY, get, set, useStored } from '../store';
import { remote } from '../remote';
import { adminSignIn, adminSignOut, onSyncError, requestReset, useIsAdmin, useRole } from '../sync';
import { ErrorText, Field, useForm } from '../components/ui';
import { go, type Route } from '../router';
import type { Message, Order, Review } from '../types';
import { Customers, Discounts, Messages, ReviewsView } from './views';
import { Dashboard } from './dashboard';
import { OrdersView } from './orders';
import { SettingsView } from './settings';
import { CatalogView, ProductsView } from './catalog';
import { ActivityView, AlertsView, GiftCardsView } from './owner';

interface AdminSession { email: string }
const NO_ADMIN: AdminSession | null = null;
export const ADMIN_EMAIL = 'admin@emberandeve.example';

const VIEWS = ['dash', 'orders', 'products', 'catalog', 'customers', 'discounts', 'giftcards', 'alerts', 'reviews', 'messages', 'activity', 'settings'] as const;
type View = (typeof VIEWS)[number];
const GROUPS: [string, View[]][] = [['Overview', ['dash', 'orders']], ['Shop', ['products', 'catalog', 'discounts', 'giftcards', 'alerts']], ['People', ['customers', 'reviews', 'messages']], ['System', ['activity', 'settings']]];
const LABELS: Record<View, string> = { dash: 'Dashboard', orders: 'Orders', products: 'Products', catalog: 'Catalogue', customers: 'Customers', discounts: 'Discounts', giftcards: 'Gift cards', alerts: 'Back in stock', reviews: 'Reviews', messages: 'Messages', activity: 'Activity', settings: 'Settings' };

export function Admin({ route }: { route: Route }) {
  const localAdmin = useStored<AdminSession | null>('admin', NO_ADMIN);
  const isAdmin = useIsAdmin();
  const role = useRole();
  const admin: AdminSession | null = remote ? (isAdmin ? { email: 'Signed in' } : null) : localAdmin;
  const staff = remote && role === 'staff';
  const orders = useStored<Order[]>('orders', EMPTY);
  const reviews = useStored<Review[]>('reviews', EMPTY);
  const msgs = useStored<Message[]>('messages', EMPTY);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 1800); };

  useEffect(() => onSyncError((m) => { setToast(m); window.setTimeout(() => setToast(''), 5000); }), []);

  if (!admin) return <AdminLogin />;

  const view: View = staff ? 'orders' : (VIEWS as readonly string[]).includes(route.arg) ? (route.arg as View) : 'dash';
  const toCheck = orders.filter((o) => o.status !== 'Cancelled' && o.payStatus === 'Receipt sent').length;
  const toProcess = orders.filter((o) => o.status === 'Processing').length;
  const badge: Partial<Record<View, number>> = {
    orders: (staff ? toProcess : toCheck || toProcess) + orders.filter((o) => o.cancelRequest?.state === 'pending' && o.status !== 'Cancelled').length,
    reviews: reviews.filter((r) => !r.approved).length,
    messages: msgs.filter((m) => !m.read).length,
  };

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <img src="/logo.png" alt="" width={38} height={38} />
          <div><b>Ember &amp; Eve</b><span>Shop admin</span></div>
        </div>
        <nav aria-label="Admin" style={{ display: 'contents' }}>
          {(staff ? [['Packing', ['orders'] as View[]] as [string, View[]]] : GROUPS).map(([group, items]) => (
            <div key={group} style={{ display: 'contents' }}>
              <div className="admin-group">{group}</div>
              {items.map((v) => (
                <button key={v} type="button" className={'admin-nav' + (view === v ? ' on' : '')} aria-current={view === v ? 'page' : undefined} onClick={() => go('admin/' + v)}>
                  <Icon name={v} /><span className="nav-label">{staff ? 'Orders to pack' : LABELS[v]}</span>
                  {!!badge[v] && <span className="nav-count" aria-label={badge[v] + ' waiting'}>{badge[v]}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-foot">
          <a href="/">View store</a>
          <div className="admin-user">{admin.email}{staff ? ' · Staff' : ''}</div>
          <button type="button" className="admin-signout" onClick={() => (remote ? void adminSignOut() : set('admin', null))}>Sign out</button>
        </div>
      </aside>

      <main className="admin-main">
        {view === 'dash' && <Dashboard />}
        {view === 'orders' && <OrdersView sel={route.q.sel || ''} pay={route.q.pay || ''} status={route.q.status || ''} flash={flash} />}
        {view === 'products' && <ProductsView flash={flash} />}
        {view === 'catalog' && <CatalogView flash={flash} />}
        {view === 'customers' && <Customers />}
        {view === 'discounts' && <Discounts flash={flash} />}
        {view === 'giftcards' && <GiftCardsView flash={flash} />}
        {view === 'alerts' && <AlertsView flash={flash} />}
        {view === 'activity' && <ActivityView />}
        {view === 'reviews' && <ReviewsView />}
        {view === 'messages' && <Messages />}
        {view === 'settings' && <SettingsView flash={flash} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function AdminLogin() {
  const { bind, str, set: patch } = useForm();
  const [err, setErr] = useState('');

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(str('email').trim())) return setErr('Enter your email above first.');
    const e = await requestReset(str('email').trim());
    if (e) return setErr(e);
    setErr(''); setNote('If that email belongs to an admin account, a reset link is on its way.');
  };
  const submit = async () => {
    if (remote) {
      setBusy(true);
      const e = await adminSignIn(str('email').trim(), str('password'));
      setBusy(false);
      return setErr(e);
    }
    const pw = get<string>('adminpw', 'admin123');
    if (str('email').trim().toLowerCase() !== ADMIN_EMAIL || str('password') !== pw) return setErr('Email or password is incorrect.');
    set<AdminSession>('admin', { email: ADMIN_EMAIL });
  };

  return (
    <div className="admin-shell" style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#1E2023' }}>
      <form className="card stack" style={{ width: 'min(420px,100%)', gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Ember & Eve" width={48} height={48} style={{ borderRadius: 9999 }} />
          <div>
            <div className="h3">Admin</div>
            <div className="muted">Ember &amp; Eve staff sign in</div>
          </div>
        </div>
        <div className="fields one">
          <Field label="Email" type="email" {...bind('email')} autoComplete="username" />
          <Field label="Password" type="password" {...bind('password')} autoComplete="current-password" />
        </div>
        <ErrorText>{err}</ErrorText>
        {note && <div className="ok">{note}</div>}
        <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        {remote && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={forgot}>Forgot password?</button>}
        {!remote && <div style={{ background: 'var(--cream)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text2)' }}>
          Demo admin: admin@emberandeve.example / admin123{' '}
          <button type="button" className="link-btn" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => { patch({ email: ADMIN_EMAIL, password: 'admin123' }); setErr(''); }}>Fill</button>
        </div>}
        <a href="/" style={{ fontSize: 12, textAlign: 'center' }}>Back to the store</a>
      </form>
    </div>
  );
}
