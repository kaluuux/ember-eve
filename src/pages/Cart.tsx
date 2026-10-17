import { useApp } from '../AppContext';
import { DiscountBox } from '../components/DiscountBox';
import { Stepper } from '../components/ui';
import { freeMessage } from '../commerce';
import { money } from '../store';

export function Cart() {
  const { cart, setQty, totals: T } = useApp();
  const freePct = Math.min(100, T.sub === 0 ? 0 : Math.round(((T.freeOver - T.freeLeft) / T.freeOver) * 100));

  return (
    <section className="page">
      <h1 className="h1" style={{ marginBottom: 24 }}>Your Basket</h1>
      {cart.length === 0 ? (
        <div className="card stack" style={{ textAlign: 'center', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Your basket is empty.</div>
          <a href="#/shop" className="btn">Start Shopping</a>
        </div>
      ) : (
        <div className="layout-main-side">
          <div className="stack" style={{ gap: 12, minWidth: 0 }}>
            {cart.map((l) => {
              const href = l.pid ? '#/product/' + l.pid : '#/gifts';
              return (
                <div key={l.key} className="card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a href={href} aria-label={l.name} style={{ width: 80, height: 80, borderRadius: 8, background: l.tint, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <a href={href} style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none' }}>{l.name}</a>
                    <div className="muted">{l.sub}</div>
                    <div className="muted">{money(l.unit)} each</div>
                    <button type="button" className="link-btn" style={{ marginTop: 4 }} onClick={() => setQty(l.key, -9999)}>Remove</button>
                  </div>
                  <Stepper small qty={l.qty} onDec={() => setQty(l.key, -1)} onInc={() => setQty(l.key, 1)} />
                  <div style={{ minWidth: 64, textAlign: 'right', fontWeight: 600 }}>{money(l.unit * l.qty)}</div>
                </div>
              );
            })}
            <a href="#/shop" style={{ fontSize: 14, fontWeight: 500 }}>Continue shopping</a>
          </div>
          <aside className="card stack" style={{ gap: 12 }}>
            <div className="h3">Order Summary</div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>{freeMessage(T)}</div>
            <div style={{ height: 6, borderRadius: 9999, background: 'var(--sand-l)' }}><div style={{ height: 6, borderRadius: 9999, background: 'var(--brown)', width: freePct + '%' }} /></div>
            <DiscountBox />
            <Summary />
            <a href="#/checkout" className="btn">Checkout</a>
          </aside>
        </div>
      )}
    </section>
  );
}

export function Summary({ shipLabel = 'Delivery (standard)', totals }: { shipLabel?: string; totals?: ReturnType<typeof useApp>['totals'] }) {
  const app = useApp();
  const T = totals ?? app.totals;
  return (
    <>
      <div style={row}><span>Subtotal</span><span>{money(T.sub)}</span></div>
      {T.disc > 0 && <div style={{ ...row, color: 'var(--green)' }}><span>Discount</span><span>-{money(T.disc)}</span></div>}
      <div style={row}><span>{shipLabel}</span><span>{T.ship === 0 ? (T.sub === 0 ? '-' : 'Free') : money(T.ship)}</span></div>
      {T.wrap > 0 && <div style={row}><span>Gift wrap</span><span>{money(T.wrap)}</span></div>}
      <div style={{ ...row, fontSize: 18, fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 12 }}><span>Total</span><span>{money(T.total)}</span></div>
    </>
  );
}

const row = { display: 'flex', justifyContent: 'space-between', fontSize: 14 } as const;
