import { useEffect, useState } from 'react';
import { EMPTY, get, set, useStored } from '../store';
import { remote } from '../remote';
import { adminSignIn, adminSignOut, onSyncError, useIsAdmin } from '../sync';
import { ErrorText, Field, useForm } from '../components/ui';
import { go, type Route } from '../router';
import type { Message, Order, Review } from '../types';
import { Customers, Dashboard, Discounts, Messages, OrdersView, ReviewsView, SettingsView } from './views';
import { CatalogView, ProductsView } from './catalog';

interface AdminSession { email: string }
const NO_ADMIN: AdminSession | null = null;
export const ADMIN_EMAIL = 'admin@emberandeve.example';

const VIEWS = ['dash', 'orders', 'products', 'catalog', 'customers', 'discounts', 'reviews', 'messages', 'settings'] as const;
type View = (typeof VIEWS)[number];
const LABELS: Record<View, string> = { dash: 'Dashboard', orders: 'Orders', products: 'Products', catalog: 'Catalogue setup', customers: 'Customers', discounts: 'Discounts', reviews: 'Reviews', messages: 'Messages', settings: 'Settings' };

export function Admin({ route }: { route: Route }) {
  const localAdmin = useStored<AdminSession | null>('admin', NO_ADMIN);
  const isAdmin = useIsAdmin();
  const admin: AdminSession | null = remote ? (isAdmin ? { email: 'Signed in' } : null) : localAdmin;
  const orders = useStored<Order[]>('orders', EMPTY);
  const reviews = useStored<Review[]>('reviews', EMPTY);
  const msgs = useStored<Message[]>('messages', EMPTY);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 1800); };

  useEffect(() => onSyncError((m) => { setToast(m); window.setTimeout(() => setToast(''), 5000); }), []);

  if (!admin) return <AdminLogin />;

  const view: View = (VIEWS as readonly string[]).includes(route.arg) ? (route.arg as View) : 'dash';
  const badge: Partial<Record<View, string>> = {
    orders: orders.filter((o) => o.status === 'Processing').length ? orders.filter((o) => o.status === 'Processing').length + ' new' : '',
    reviews: reviews.filter((r) => !r.approved).length ? String(reviews.filter((r) => !r.approved).length) : '',
    messages: msgs.filter((m) => !m.read).length ? String(msgs.filter((m) => !m.read).length) : '',
  };

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 16px' }}>
          <img src="/logo.png" alt="" width={36} height={36} style={{ borderRadius: 9999 }} />
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>Ember &amp; Eve<div style={{ font: '500 12px Inter', color: '#CDBFB1' }}>Admin</div></div>
        </div>
        <nav aria-label="Admin" style={{ display: 'contents' }}>
          {VIEWS.map((v) => (
            <button key={v} type="button" className={'admin-nav' + (view === v ? ' on' : '')} aria-current={view === v ? 'page' : undefined} onClick={() => go('admin/' + v)}>
              <span>{LABELS[v]}</span><span style={{ color: '#CDBFB1' }}>{badge[v] ?? ''}</span>
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <a href="#/" style={{ color: '#D9CCBF', fontSize: 14, padding: '8px 12px', textDecoration: 'none' }}>View store</a>
        <button type="button" className="admin-nav" style={{ border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => (remote ? void adminSignOut() : set('admin', null))}>Sign Out</button>
        <div style={{ fontSize: 12, color: '#CDBFB1', padding: '8px 12px', wordBreak: 'break-all' }}>{admin.email}</div>
      </aside>

      <main style={{ flex: 1, minWidth: 300, padding: '32px 24px' }}>
        {view === 'dash' && <Dashboard />}
        {view === 'orders' && <OrdersView sel={route.q.sel || ''} flash={flash} />}
        {view === 'products' && <ProductsView flash={flash} />}
        {view === 'catalog' && <CatalogView flash={flash} />}
        {view === 'customers' && <Customers />}
        {view === 'discounts' && <Discounts flash={flash} />}
        {view === 'reviews' && <ReviewsView />}
        {view === 'messages' && <Messages />}
        {view === 'settings' && <SettingsView />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function AdminLogin() {
  const { bind, str, set: patch } = useForm();
  const [err, setErr] = useState('');

  const [busy, setBusy] = useState(false);
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--ink)' }}>
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
        <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        {!remote && <div style={{ background: 'var(--cream)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text2)' }}>
          Demo admin: admin@emberandeve.example / admin123{' '}
          <button type="button" className="link-btn" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => { patch({ email: ADMIN_EMAIL, password: 'admin123' }); setErr(''); }}>Fill</button>
        </div>}
        <a href="#/" style={{ fontSize: 12, textAlign: 'center' }}>Back to the store</a>
      </form>
    </div>
  );
}
