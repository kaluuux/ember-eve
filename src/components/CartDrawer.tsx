import { useApp } from '../AppContext';
import { freeMessage, lineText, soft } from '../commerce';
import { money } from '../store';

export function CartDrawer() {
  const { cartOpen, setCartOpen, cart, setQty, totals } = useApp();
  if (!cartOpen) return null;
  const close = () => setCartOpen(false);
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Basket">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
          <div className="h3">Your basket</div>
          <button type="button" onClick={close} style={{ font: '500 14px Inter', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>Close</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cart.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 8px', color: 'var(--muted)' }}>
              <div className="h3" style={{ marginBottom: 6 }}>Your basket is empty</div>
              <p style={{ margin: '0 0 18px', fontSize: 14 }}>A candle is waiting to be chosen.</p>
              <a href="#/shop" className="btn sm" onClick={close}>Browse candles</a>
            </div>
          )}
          {cart.map((l) => (
            <div key={l.key} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 14, background: soft(l.tint), flex: 'none', border: '1px solid var(--line)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{lineText(l)} · {money(l.unit * l.qty)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setQty(l.key, -1)} aria-label="Decrease quantity" style={qtyBtn}>-</button>
                <span style={{ fontSize: 14, minWidth: 16, textAlign: 'center' }}>{l.qty}</span>
                <button type="button" onClick={() => setQty(l.key, 1)} aria-label="Increase quantity" style={qtyBtn}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}><span>Subtotal</span><span>{money(totals.sub)}</span></div>
          <div className="meter" aria-hidden="true"><div style={{ width: (totals.sub === 0 ? 0 : Math.min(100, Math.round(((totals.freeOver - totals.freeLeft) / totals.freeOver) * 100))) + '%' }} /></div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{freeMessage(totals)}</div>
          <a href="#/cart" className="btn ghost" onClick={close}>View Basket</a>
          <a href="#/checkout" className="btn" onClick={close}>Checkout</a>
        </div>
      </aside>
    </>
  );
}

const qtyBtn = { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--sand)', background: '#fff', cursor: 'pointer' } as const;
