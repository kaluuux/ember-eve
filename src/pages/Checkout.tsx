import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { DiscountBox } from '../components/DiscountBox';
import { Summary } from './Cart';
import { Chip, ErrorText, Field, useForm } from '../components/ui';
import { computeTotals } from '../commerce';
import { get, isEmail, money, set } from '../store';
import { go } from '../router';
import type { Order, Product, User } from '../types';

type ShipM = 'standard' | 'express';

export function Checkout() {
  const { cart, user, disc, discObj, settings: st, clearCart } = useApp();
  const saved = useMemo(() => (user ? get<User[]>('users', []).find((u) => u.id === user.id)?.address ?? {} : {}), [user]);
  const { bind, str } = useForm({ ...saved, email: user?.email ?? '' });
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [shipM, setShipM] = useState<ShipM>('standard');
  const [wrap, setWrap] = useState(false);
  const [pay, setPay] = useState<'card' | 'paypal'>('card');

  const T = computeTotals(cart, discObj, st, shipM, wrap);
  const stdFree = computeTotals(cart, discObj, st, 'standard').ship === 0;
  const steps = ['1 Information', '2 Delivery', '3 Payment'];

  const field = (name: string, label: string, o: { type?: string; ph?: string; span?: 1 | 2 } = {}) => <Field key={name} label={label} {...bind(name)} type={o.type} placeholder={o.ph} span={o.span} />;

  const next = () => {
    if (step === 1) {
      if (!isEmail(str('email'))) return setErr('Enter a valid email address.');
      for (const [k, n] of [['first', 'first name'], ['last', 'last name'], ['a1', 'address'], ['city', 'town or city'], ['post', 'postcode']] as const) {
        if (!str(k).trim()) return setErr('Enter your ' + n + '.');
      }
      setErr(''); return setStep(2);
    }
    if (step === 2) { setErr(''); return setStep(3); }

    const digits = str('cardno').replace(/\s/g, '');
    if (pay === 'card') {
      if (!/^\d{16}$/.test(digits)) return setErr('Enter a 16 digit card number.');
      if (!str('cardname').trim()) return setErr('Enter the name on the card.');
      if (!/^\d{2}\/\d{2}$/.test(str('exp'))) return setErr('Enter expiry as MM/YY.');
      if (!/^\d{3,4}$/.test(str('cvc'))) return setErr('Enter the security code.');
    }

    const orders = get<Order[]>('orders', []);
    const nextNum = orders.reduce((m, o) => Math.max(m, Number(o.id.replace(/\D/g, '')) || 0), 1000) + 1;
    const id = 'EE-' + nextNum, iso = new Date().toISOString();
    const order: Order = {
      id, date: iso, email: str('email'), name: str('first') + ' ' + str('last'), first: str('first'), phone: str('phone'),
      address: { a1: str('a1'), a2: str('a2'), city: str('city'), post: str('post') },
      items: cart.map((l) => ({ name: l.name, sub: l.sub, qty: l.qty, unit: l.unit, tint: l.tint, pid: l.pid, si: l.si })),
      sub: T.sub, disc: T.disc, code: disc, ship: T.ship, shipM, wrap: T.wrap, total: T.total, status: 'Processing',
      pay: pay === 'card' ? 'Card ending ' + digits.slice(-4) : 'PayPal', note: str('gnote'), userId: user ? user.id : null, log: [{ s: 'Placed', d: iso }],
    };
    const products = get<Product[]>('products', []);
    cart.forEach((l) => {
      if (!l.pid) return;
      const p = products.find((x) => x.id === l.pid);
      if (p?.sizes[l.si]) p.sizes[l.si].stock = Math.max(0, p.sizes[l.si].stock - l.qty);
    });
    set('products', products);
    set('orders', orders.concat(order));
    set('myorders', get<string[]>('myorders', []).concat(id));
    clearCart();
    go('order/' + id + '?new=1');
  };

  const back = () => { setErr(''); setStep(Math.max(1, step - 1)); };
  const addr = [str('first'), str('last')].filter(Boolean).join(' ') + ', ' + [str('a1'), str('city'), str('post')].filter(Boolean).join(', ');

  return (
    <section className="page">
      <h1 className="h1" style={{ marginBottom: 16 }}>Checkout</h1>
      {cart.length === 0 ? (
        <div className="card stack" style={{ textAlign: 'center', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Your basket is empty.</div>
          <a href="#/shop" className="btn">Start Shopping</a>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {steps.map((l, i) => {
              const done = step > i + 1, on = step === i + 1;
              return (
                <span key={l} aria-current={on ? 'step' : undefined} style={{ font: '500 14px Inter', padding: '8px 16px', borderRadius: 9999, border: `1px solid ${on || done ? 'var(--brown)' : 'var(--sand)'}`, background: on ? 'var(--brown)' : done ? 'var(--cream)' : '#fff', color: on ? '#fff' : 'var(--ink)' }}>{l}</span>
              );
            })}
          </div>
          <div className="layout-main-side">
            <div className="stack" style={{ gap: 16, minWidth: 0 }}>
              {step === 1 && (
                <div className="card stack" style={{ gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div className="h3">Contact and delivery address</div>
                    {!user && <a href="#/login?next=checkout" style={{ fontSize: 14, fontWeight: 500 }}>Have an account? Sign in</a>}
                  </div>
                  <div className="fields two">
                    {field('email', 'Email', { type: 'email', ph: 'you@example.com', span: 2 })}
                    {field('first', 'First name')}
                    {field('last', 'Last name')}
                    {field('phone', 'Phone (optional)', { type: 'tel', span: 2 })}
                    {field('a1', 'Address', { span: 2 })}
                    {field('a2', 'Flat, suite (optional)', { span: 2 })}
                    {field('city', 'Town or city')}
                    {field('post', 'Postcode')}
                  </div>
                  <Field label="Gift message (optional)" {...bind('gnote')} rows={2} placeholder="Added to the packing slip" />
                  <ErrorText>{err}</ErrorText>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <a href="#/cart" className="btn ghost">Back to Basket</a>
                    <button type="button" className="btn" onClick={next}>Continue to Delivery</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="card stack" style={{ gap: 16 }}>
                  <div className="h3">Delivery</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)' }}>Deliver to: {addr} <button type="button" className="link-btn" onClick={() => setStep(1)}>Edit</button></div>
                  {([['standard', 'Standard', '3 to 5 working days', stdFree ? 'Free' : money(st.standard)], ['express', 'Express', 'Next working day', money(st.express)]] as const).map(([id, label, eta, price]) => (
                    <OptionRow key={id} on={shipM === id} onClick={() => setShipM(id)} title={label} sub={eta} price={price} />
                  ))}
                  <OptionRow on={wrap} onClick={() => setWrap(!wrap)} title="Gift wrap" sub="Kraft box, ribbon and message card" price={money(st.giftWrap)} />
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button type="button" className="btn ghost" onClick={back}>Back</button>
                    <button type="button" className="btn" onClick={next}>Continue to Payment</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="card stack" style={{ gap: 16 }}>
                  <div className="h3">Payment</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Chip size="wide" on={pay === 'card'} onClick={() => { setPay('card'); setErr(''); }}>Card</Chip>
                    <Chip size="wide" on={pay === 'paypal'} onClick={() => { setPay('paypal'); setErr(''); }}>PayPal</Chip>
                  </div>
                  {pay === 'card' ? (
                    <div className="fields two">
                      {field('cardno', 'Card number', { ph: '1234 5678 9012 3456', span: 2 })}
                      {field('cardname', 'Name on card', { span: 2 })}
                      {field('exp', 'Expiry', { ph: 'MM/YY' })}
                      {field('cvc', 'Security code', { ph: '123' })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: 'var(--text2)' }}>You will be sent to PayPal to approve the payment (demo, no redirect).</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Demo store: no payment is taken. Enter any 16 digits.</div>
                  <ErrorText>{err}</ErrorText>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button type="button" className="btn ghost" onClick={back}>Back</button>
                    <button type="button" className="btn" onClick={next}>Place Order · {money(T.total)}</button>
                  </div>
                </div>
              )}
            </div>

            <aside className="card stack" style={{ gap: 12 }}>
              <div className="h3">Order Summary</div>
              {cart.map((l) => (
                <div key={l.key} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: l.tint, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                    <div style={{ fontWeight: 500 }}>{l.name}</div>
                    <div className="muted">{l.sub} · Qty {l.qty}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{money(l.unit * l.qty)}</div>
                </div>
              ))}
              <DiscountBox />
              <Summary shipLabel="Delivery" totals={T} />
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function OptionRow({ on, onClick, title, sub, price }: { on: boolean; onClick: () => void; title: string; sub: string; price: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ textAlign: 'left', font: '500 16px Inter', padding: 16, borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? 'var(--brown)' : 'var(--sand)'}`, background: on ? 'var(--cream)' : '#fff', color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{title}<br /><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{sub}</span></span>
      <span>{price}</span>
    </button>
  );
}
