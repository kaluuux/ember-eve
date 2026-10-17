import { useApp } from '../AppContext';
import { lineText, orderView } from '../commerce';
import { get, money, useStored, EMPTY } from '../store';
import type { Order as OrderT } from '../types';
import type { Route } from '../router';

export function Order({ route }: { route: Route }) {
  const { user } = useApp();
  const orders = useStored<OrderT[]>('orders', EMPTY);
  const mine = get<string[]>('myorders', []);
  const raw = orders.find((o) => o.id === route.arg);
  const allowed = raw && ((user && (raw.userId === user.id || raw.email === user.email)) || mine.includes(raw.id));
  const ord = allowed && raw ? orderView(raw) : null;

  if (!ord) {
    return (
      <section className="page">
        <div className="card stack" style={{ textAlign: 'center', alignItems: 'center', gap: 12 }}>
          <h1 className="h1">Order not found</h1>
          <p className="muted" style={{ margin: 0 }}>Sign in to your account, or use Track Order with your order number and email.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="#/login?next=account" className="btn">Sign In</a>
            <a href="#/track" className="btn ghost">Track Order</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      {route.q.new && (
        <div className="card" style={{ marginBottom: 24, background: 'var(--cream)' }}>
          <h1 className="h1">Thank you, {ord.first || ord.name.split(' ')[0]}.</h1>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--text2)' }}>Order {ord.id} is confirmed. A confirmation has been sent to {ord.email} (demo).</p>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 className="h2">Order {ord.id}</h2>
        <span className="tag" style={{ fontSize: 14, background: ord.statusBg, color: ord.statusFg }}>{ord.status}</span>
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {ord.timeline.map((t, i) => (
            <div key={i}>
              <div style={{ height: 6, borderRadius: 9999, background: t.bg }} />
              <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: t.fg }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="layout-main-side">
        <div className="card stack" style={{ gap: 12 }}>
          <div className="h3">Items</div>
          {ord.items.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: l.tint, flex: 'none' }} />
              <div style={{ flex: 1, fontSize: 14 }}>
                <div style={{ fontWeight: 500 }}>{l.name}</div>
                <div className="muted">{lineText(l)} · Qty {l.qty}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{money(l.unit * l.qty)}</div>
            </div>
          ))}
        </div>
        <aside className="card stack" style={{ gap: 8, fontSize: 14 }}>
          <div className="h3">Details</div>
          <div><b>Placed</b><br />{ord.dateL}</div>
          <div><b>Deliver to</b><br />{ord.name}<br />{ord.addr}</div>
          <div><b>Delivery</b><br />{ord.shipName}</div>
          {ord.sellerNote && <div><b>Your note to us</b><br />{ord.sellerNote}</div>}
          <div><b>Payment</b><br />{ord.pay}</div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(ord.sub)}</span></div>
          {ord.disc > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>Discount</span><span>-{money(ord.disc)}</span></div>}
          {ord.wrap > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gift wrap</span><span>{money(ord.wrap)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery</span><span>{ord.shipL}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}><span>Total</span><span>{money(ord.total)}</span></div>
        </aside>
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="#/shop" className="btn">Continue Shopping</a>
        {user && <a href="#/account" className="btn ghost">My Orders</a>}
      </div>
    </section>
  );
}
