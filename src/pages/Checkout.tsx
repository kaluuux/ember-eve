import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { DiscountBox } from '../components/DiscountBox';
import { BankAccounts } from '../components/BankAccounts';
import { CheckoutGate } from '../components/CheckoutGate';
import { Summary } from './Cart';
import { ErrorText, Field, useForm } from '../components/ui';
import { computeTotals, lineText, type Totals, soft } from '../commerce';
import { EMPTY, SL_DISTRICTS, addressBook, get, isEmail, money, set, setLocal, useStored } from '../store';
import { remote } from '../remote';
import { orderErrorText, placeOrder, quoteOrder, saveProfile } from '../sync';
import { go } from '../router';
import type { CartLine, Order, PayMethod, Product, SavedAddress, User } from '../types';

type ShipM = 'standard' | 'express' | 'pickup';

const PAY_INFO: Record<PayMethod, { title: string; sub: string }> = {
  bank: { title: 'Bank transfer / LankaQR', sub: 'Scan a LankaQR code or pay into our account, then upload your receipt or send it on WhatsApp. We approve it and start pouring.' },
  store: { title: 'Pay at store pickup', sub: 'Pay when you collect your order.' },
  whatsapp: { title: 'Arrange payment on WhatsApp', sub: 'We will message you to arrange payment.' },
  card: { title: 'Card', sub: '' },
};

export function Checkout() {
  const { cart, user, disc, discObj, settings: st, clearCart, flash } = useApp();
  const users = useStored<User[]>('users', EMPTY);
  const me = useMemo(() => (user ? users.find((u) => u.id === user.id) : undefined), [user, users]);
  const book = useMemo(() => addressBook(me), [me]);
  const dflt = book.find((a) => a.isDefault) ?? book[0];
  const saved = useMemo(() => (dflt ? { first: dflt.name.split(' ')[0], last: dflt.name.split(' ').slice(1).join(' '), phone: dflt.phone || me?.phone || '', a1: dflt.a1, a2: dflt.a2, city: dflt.city, district: dflt.district, post: dflt.post } : me?.phone ? { phone: me.phone, first: me.name.split(' ')[0], last: me.name.split(' ').slice(1).join(' ') } : {}), [dflt, me]);
  const { bind, str, set: patch } = useForm({ ...saved, email: user?.email ?? '' });
  const [guest, setGuest] = useState(() => { try { return sessionStorage.getItem('ee_guest') === '1'; } catch { return false; } });
  const [addrId, setAddrId] = useState('');
  const [saveNew, setSaveNew] = useState(true);
  const [addrLabel, setAddrLabel] = useState('');
  const chosen = addrId || dflt?.id || 'new';
  const useAddress = (a: SavedAddress | null) => {
    if (a) { setAddrId(a.id); patch({ a1: a.a1, a2: a.a2, city: a.city, district: a.district, post: a.post }); }
    else { setAddrId('new'); patch({ a1: '', a2: '', city: '', district: '', post: '' }); }
  };
  // fill the form from the saved address once it is available (it can arrive from the server after first render)
  const savedKey = JSON.stringify(saved) + (user?.email ?? '');
  useEffect(() => { patch({ ...saved, email: user?.email ?? '' }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [savedKey]);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [shipM, setShipM] = useState<ShipM>('standard');
  const [wrap, setWrap] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('bank');
  const [bankId, setBankId] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Order | null>(null);

  const pickupOn = st.pickupAddress.trim() !== '';
  const methods = (['bank', 'store', 'whatsapp'] as PayMethod[]).filter((m) => st.pay[m] && (m !== 'store' || shipM === 'pickup') && (m !== 'bank' || st.banks.some((b) => b.number.trim() !== '')));
  const pay: PayMethod = methods.includes(payMethod) ? payMethod : methods[0];
  const banks = st.banks.filter((b) => b.number.trim());
  const bank = banks.find((b) => b.id === bankId) ?? banks[0];
  const district = str('district');

  // online baskets must carry the customer's choices so the server can price them
  const stale = remote && cart.some((l) => !l.box && !l.sel);
  useEffect(() => {
    if (!stale) return;
    set('cart', get<CartLine[]>('cart', []).filter((l) => l.box || l.sel));
    flash('Some older items were removed from your basket. Please add them again.');
  }, [stale, flash]);

  const local = computeTotals(cart, discObj, st, shipM, wrap, district);
  const stdFree = computeTotals(cart, discObj, st, 'standard', false, district).ship === 0;
  const T: Totals = quote ? { ...local, sub: quote.sub, disc: quote.disc, ship: quote.ship, wrap: quote.wrap, total: quote.total } : local;
  const steps = ['1 Your details', '2 Delivery', '3 Payment'];

  const payload = () => ({
    email: str('email').trim(), name: (str('first') + ' ' + str('last')).trim(), first: str('first').trim(), phone: str('phone').trim(),
    address: shipM === 'pickup' ? { a1: '', a2: '', city: '', district: '', post: '' } : { a1: str('a1').trim(), a2: str('a2').trim(), city: str('city').trim(), district: str('district'), post: str('post').trim() },
    items: cart.map((l) => (l.box ? { pid: 0, qty: l.qty, box: l.box, boxId: l.boxId, note: l.note } : { pid: l.pid, qty: l.qty, sel: l.sel })),
    code: disc, shipM, wrap, payMethod: pay, payBank: pay === 'bank' ? bank?.bank : undefined, note: str('gnote').trim(), sellerNote: str('snote').trim(),
  });

  // the server's own totals for step 3 (and whenever the choices that affect price change)
  useEffect(() => {
    if (!remote || step !== 3 || stale) return;
    let live = true;
    setQuote(null);
    quoteOrder(payload()).then((q) => { if (live) { setQuote(q); setErr(''); } }).catch((e) => { if (live) setErr(orderErrorText(e)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, shipM, wrap, pay, disc, cart, district, bankId]);

  const field = (name: string, label: string, o: { type?: string; ph?: string; span?: 1 | 2 } = {}) => <Field key={name} label={label} {...bind(name)} type={o.type} placeholder={o.ph} span={o.span} />;

  const next = async () => {
    if (busy) return;
    if (step === 1) {
      if (!isEmail(str('email'))) return setErr('Enter a valid email address.');
      if (!str('first').trim() || !str('last').trim()) return setErr('Enter your first and last name.');
      if (!/^[+\d][\d\s-]{8,}$/.test(str('phone').trim())) return setErr('Enter a phone number we can reach you on (we use it for delivery).');
      setErr(''); return setStep(2);
    }
    if (step === 2) {
      if (shipM !== 'pickup') {
        for (const [k, n] of [['a1', 'address'], ['city', 'town or city'], ['district', 'district']] as const) if (!str(k).trim()) return setErr('Enter your ' + n + '.');
      }
      setErr(''); return setStep(3);
    }
    if (!pay) return setErr('We cannot take payment online just yet. Please contact us' + (st.whatsapp ? ' on WhatsApp' : '') + ' to place your order.');

    let order: Order;
    setBusy(true);
    if (remote) {
      try {
        order = await placeOrder(payload());
      } catch (e) {
        setBusy(false);
        return setErr(orderErrorText(e));
      }
      setLocal('orders', get<Order[]>('orders', []).filter((o) => o.id !== order.id).concat(order));
    } else {
      const orders = get<Order[]>('orders', []);
      const nextNum = orders.reduce((m, o) => Math.max(m, Number(o.id.replace(/\D/g, '')) || 0), 1000) + 1;
      const iso = new Date().toISOString(), p = payload();
      order = {
        id: 'EE-' + nextNum, date: iso, email: p.email, name: p.name, first: p.first, phone: p.phone, address: p.address,
        items: cart.map((l) => ({ name: l.name, sub: l.sub, qty: l.qty, unit: l.unit, tint: l.tint, pid: l.pid, ...(l.sel ? { sel: l.sel } : {}), ...(l.note ? { note: l.note } : {}), ...(l.box ? { box: l.box.map((c) => ({ pid: c.pid, name: get<Product[]>('products', []).find((x) => x.id === c.pid)?.name ?? '' })) } : {}) })),
        sub: T.sub, disc: T.disc, code: disc, ship: T.ship, shipM, wrap: T.wrap, total: T.total, status: 'Processing',
        pay: PAY_INFO[pay].title, payMethod: pay, payBank: pay === 'bank' ? bank?.bank ?? null : null, payStatus: 'Pending', note: p.note, sellerNote: p.sellerNote, userId: user ? user.id : null, log: [{ s: 'Placed', d: iso }],
      };
      const products = get<Product[]>('products', []);
      cart.forEach((l) => {
        (l.box ? l.box.map((c) => c.pid) : l.pid ? [l.pid] : []).forEach((id) => {
          const pr = products.find((x) => x.id === id);
          if (pr && pr.stock !== null) pr.stock = Math.max(0, pr.stock - l.qty);
        });
      });
      set('products', products);
      set('orders', orders.concat(order));
    }
    setBusy(false);
    if (user && shipM !== 'pickup' && chosen === 'new' && saveNew && str('a1').trim()) {
      const entry: SavedAddress = { id: 'a' + Date.now().toString(36), label: addrLabel.trim() || (book.length ? 'Address ' + (book.length + 1) : 'Home'), name: (str('first') + ' ' + str('last')).trim(), phone: str('phone').trim(), a1: str('a1').trim(), a2: str('a2').trim(), city: str('city').trim(), district: str('district'), post: str('post').trim(), isDefault: book.length === 0 };
      const next = book.concat(entry);
      if (remote) void saveProfile({ addresses: next, phone: me?.phone || str('phone').trim() });
      else set('users', get<User[]>('users', []).map((u) => (u.id === user.id ? { ...u, addresses: next } : u)));
    }
    set('myorders', get<string[]>('myorders', []).concat(order.id));
    clearCart();
    go('order/' + order.id + '?new=1');
  };

  const back = () => { setErr(''); setStep(Math.max(1, step - 1)); };
  const addr = [str('a1'), str('city'), district].filter(Boolean).join(', ');

  return (
    <section className="page">
      <h1 className="h1" style={{ marginBottom: 16 }}>Checkout</h1>
      {cart.length === 0 ? (
        <div className="card stack" style={{ textAlign: 'center', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Your basket is empty.</div>
          <a href="#/shop" className="btn">Start Shopping</a>
        </div>
      ) : !user && !guest ? (
        <CheckoutGate onGuest={() => { try { sessionStorage.setItem('ee_guest', '1'); } catch { /* ignore */ } setGuest(true); }} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {steps.map((s, i) => (
              <span key={s} style={{ fontSize: 14, fontWeight: step === i + 1 ? 600 : 500, padding: '6px 12px', borderRadius: 9999, background: step === i + 1 ? 'var(--brown)' : 'var(--sand-l)', color: step === i + 1 ? '#fff' : 'var(--muted)' }}>{s}</span>
            ))}
          </div>
          <div className="layout-main-side">
            <div className="stack" style={{ gap: 16, minWidth: 0 }}>
              {step === 1 && (
                <div className="card stack" style={{ gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div className="h3">Your details</div>
                    {user ? <span className="muted">Signed in as {user.email}</span> : <span className="muted">Checking out as a guest · <a href="#/login?next=checkout">Sign in instead</a></span>}
                  </div>
                  <div className="fields two">
                    {field('email', 'Email', { type: 'email', ph: 'you@example.com', span: 2 })}
                    {field('first', 'First name')}
                    {field('last', 'Last name')}
                    {field('phone', 'Phone / WhatsApp number', { type: 'tel', ph: '077 123 4567', span: 2 })}
                  </div>
                  <Field label="Note for the seller (optional)" {...bind('snote')} rows={3} placeholder="Colour matching, delivery instructions, anything we should know" />
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
                  {([['standard', 'Standard delivery', '3 to 5 working days', stdFree ? 'Free' : money(computeTotals(cart, discObj, st, 'standard', false, district).ship)], ['express', 'Express delivery', 'Next working day (Colombo area and main cities)', money(st.express)], ...(pickupOn ? [['pickup', 'Store pickup', st.pickupAddress, 'Free']] : [])] as [ShipM, string, string, string][]).map(([id, label, eta, price]) => (
                    <OptionRow key={id} on={shipM === id} onClick={() => setShipM(id)} title={label} sub={eta} price={price} />
                  ))}
                  {shipM !== 'pickup' && book.length > 0 && (
                    <div className="stack" style={{ gap: 8 }}>
                      <div className="label-s" style={{ margin: 0 }}>Deliver to</div>
                      <div className="addr-pick" role="radiogroup" aria-label="Saved addresses">
                        {book.map((a) => (
                          <button key={a.id} type="button" role="radio" aria-checked={chosen === a.id} className={'addr-card' + (chosen === a.id ? ' on' : '')} onClick={() => useAddress(a)}>
                            <b>{a.label || 'Address'}</b>{a.isDefault && <span className="tagpill" style={{ marginLeft: 8 }}>Default</span>}
                            <span>{a.name}{a.phone ? ' · ' + a.phone : ''}</span>
                            <span>{[a.a1, a.a2, a.city, a.district].filter(Boolean).join(', ')}</span>
                          </button>
                        ))}
                        <button type="button" role="radio" aria-checked={chosen === 'new'} className={'addr-card new' + (chosen === 'new' ? ' on' : '')} onClick={() => useAddress(null)}>
                          <b>+ Use a different address</b>
                        </button>
                      </div>
                    </div>
                  )}
                  {shipM !== 'pickup' && chosen === 'new' && (
                    <div className="fields two">
                      {field('a1', 'Address', { span: 2 })}
                      {field('a2', 'Apartment, landmark (optional)', { span: 2 })}
                      {field('city', 'Town or city')}
                      <label className="field">District
                        <select className="input" name="district" value={district} onChange={(e) => patch({ district: e.target.value })}>
                          <option value="">Select district</option>
                          {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </label>
                      {field('post', 'Postal code (optional)')}
                      {user && (
                        <div className="span2 stack" style={{ gap: 8 }}>
                          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                            <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#8F6642' }} /> Save this address to my account
                          </label>
                          {saveNew && <input className="input" aria-label="Address label" placeholder="Label, e.g. Home, Work (optional)" value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} />}
                        </div>
                      )}
                    </div>
                  )}
                  <OptionRow on={wrap} onClick={() => setWrap(!wrap)} title="Gift wrap" sub="Kraft box, ribbon and message card" price={money(st.giftWrap)} />
                  <ErrorText>{err}</ErrorText>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button type="button" className="btn ghost" onClick={back}>Back</button>
                    <button type="button" className="btn" onClick={next}>Continue to Payment</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="card stack" style={{ gap: 16 }}>
                  <div className="h3">Payment</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                    {shipM === 'pickup' ? <>Collect from: {st.pickupAddress}</> : <>Deliver to: {addr}</>} <button type="button" className="link-btn" onClick={() => setStep(2)}>Edit</button>
                  </div>
                  {methods.length === 0 && (
                    <div className="notice-warn">
                      Online payment is not set up yet, so this order cannot be placed.{' '}
                      {st.whatsapp ? <a href={'https://wa.me/' + st.whatsapp} target="_blank" rel="noreferrer">Message us on WhatsApp</a> : <>Please contact us.</>}
                    </div>
                  )}
                  {methods.map((m) => <OptionRow key={m} on={pay === m} onClick={() => setPayMethod(m)} title={PAY_INFO[m].title} sub={PAY_INFO[m].sub} price="" />)}
                  {pay === 'bank' && (
                    <div className="stack" style={{ gap: 8 }}>
                      <BankAccounts accounts={st.banks} value={bank?.id} onChange={setBankId} />
                      <div className="muted" style={{ fontSize: 13 }}>You will get your order number on the next page. Use it as the payment reference.</div>
                    </div>
                  )}
                  <ErrorText>{err}</ErrorText>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button type="button" className="btn ghost" onClick={back}>Back</button>
                    <button type="button" className="btn" onClick={next} disabled={busy || !pay || (remote && !quote && !err)}>{busy ? 'Placing order…' : 'Place Order · ' + money(T.total)}</button>
                  </div>
                </div>
              )}
            </div>

            <aside className="card stack" style={{ gap: 12 }}>
              <div className="h3">Order Summary</div>
              {cart.map((l) => (
                <div key={l.key} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: soft(l.tint), flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                    <div style={{ fontWeight: 500 }}>{l.name}</div>
                    <div className="muted">{lineText(l)} · Qty {l.qty}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{money(l.unit * l.qty)}</div>
                </div>
              ))}
              <DiscountBox />
              <Summary shipLabel={shipM === 'pickup' ? 'Store pickup' : 'Delivery'} totals={T} />
              {remote && step === 3 && quote && <div className="muted" style={{ fontSize: 12 }}>Prices confirmed by our server.</div>}
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
