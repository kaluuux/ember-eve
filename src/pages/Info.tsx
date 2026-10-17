import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, Ph, useForm } from '../components/ui';
import { WhatsInside } from './Home';
import { get, isEmail, money, set, setLocal } from '../store';
import { remote } from '../remote';
import { fetchOrder, sendMessage } from '../sync';
import { go } from '../router';
import type { Message, Order } from '../types';

const PROCESS = [
  { n: 1, t: 'Melt', d: 'Soy and coconut wax is heated to 82°C and held.' },
  { n: 2, t: 'Blend', d: 'Fragrance oil is added at 8% by weight and stirred for 3 minutes.' },
  { n: 3, t: 'Pour', d: 'Wax is poured by hand at 58°C into jars and moulds.' },
  { n: 4, t: 'Cure', d: 'Candles rest for 14 days before they are wrapped and dispatched.' },
];

export function About() {
  return (
    <>
      <section className="page">
        <div className="layout-half" style={{ alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 16 }}>About Ember &amp; Eve</h1>
            <p style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)', margin: '0 0 12px' }}>Light up your little moments. Every candle is poured by hand in small batches, then left to cure before it is wrapped for you.</p>
            <p style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)', margin: 0 }}>We pour every candle by hand in Sri Lanka, using high quality soy wax that is non-toxic and gentle on your home. Replace this text with your own story.</p>
          </div>
          <Ph tint="#EADFD3" label="the maker at work" ratio="4/3" style={{ borderRadius: 16, border: '1px solid var(--line)' }} />
        </div>
        <h2 className="h2" style={{ margin: '48px 0 24px' }}>How It's Made</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {PROCESS.map((s) => (
            <div key={s.n} className="card stack" style={{ padding: 16, gap: 8 }}>
              <Ph tint="#F3EBE1" label={s.t} ratio="3/2" style={{ padding: 8, color: 'var(--muted)' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown)' }}>Step {s.n}</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{s.t}</div>
              <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--muted)' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>
      <WhatsInside />
    </>
  );
}

export function Contact() {
  const { settings } = useApp();
  const { bind, str, setF } = useForm();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = async () => {
    if (!str('cname').trim() || !isEmail(str('cemail')) || !str('cmsg').trim()) { setOk(''); return setErr('Please complete all fields with a valid email.'); }
    const msg = { name: str('cname'), email: str('cemail'), text: str('cmsg'), date: new Date().toISOString() };
    if (remote) {
      try { await sendMessage(msg); } catch { setOk(''); return setErr('Could not send your message. Please try again.'); }
    } else {
      set<Message[]>('messages', get<Message[]>('messages', []).concat({ id: Date.now(), ...msg, read: false }));
    }
    setF({}); setErr(''); setOk('Thank you. We will reply within 2 working days.');
  };

  return (
    <section className="page">
      <h1 className="h1" style={{ marginBottom: 24 }}>Contact</h1>
      <div className="layout-half" style={{ gap: 24, alignItems: 'start' }}>
        <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="h3">Send a message</div>
          {ok && <div role="status" style={{ padding: 12, borderRadius: 8, background: 'var(--cream)', color: 'var(--green)', fontWeight: 500 }}>{ok}</div>}
          <div className="fields one">
            <Field label="Name" {...bind('cname')} />
            <Field label="Email" type="email" {...bind('cemail')} />
            <Field label="Message" {...bind('cmsg')} rows={5} />
          </div>
          <ErrorText>{err}</ErrorText>
          <div><button type="submit" className="btn" onClick={submit}>Send Message</button></div>
        </form>
        <div className="card stack" style={{ gap: 12, fontSize: 14, lineHeight: '22px' }}>
          <div className="h3">Get in touch</div>
          <div><b>Email</b><br />{settings.email}</div>
          <div><b>Phone</b><br />01234 567890</div>
          <div><b>Hours</b><br />Monday to Friday, 9am to 5pm</div>
          <div><b>Studio</b><br />Address to be added</div>
          <Ph tint="#EADFD3" ratio="16/9" style={{ padding: 8, color: 'var(--muted)' }}>Map placeholder</Ph>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: 'How long do the candles burn?', a: 'Burn time depends on size, from around 16 hours for an 80g butterfly to 60 hours for a 300g jar.' },
  { q: 'What wax do you use?', a: 'Soy wax, or a coconut-soy blend. You can choose on each product page.' },
  { q: 'Can I send a candle as a gift?', a: 'Yes. Add a gift message at checkout, choose gift wrap, or build a three-candle gift set.' },
  { q: 'Where do you deliver?', a: 'We deliver across Sri Lanka, and you can also collect from our store.' },
  { q: 'Can I change or cancel my order?', a: 'Contact us within 2 hours of ordering and we will update it before it is poured and packed.' },
  { q: 'Are the candles safe for pets?', a: 'We use phthalate-free fragrance oils, but keep all candles and flames out of reach of pets.' },
];

export function Faq() {
  const [open, setOpen] = useState(-1);
  return (
    <section className="narrow" style={{ maxWidth: 760 }}>
      <h1 className="h1" style={{ marginBottom: 24 }}>Frequently Asked Questions</h1>
      <div className="stack" style={{ gap: 12 }}>
        {FAQS.map((x, i) => (
          <div key={x.q} className="card" style={{ padding: 0 }}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', textAlign: 'left', font: '600 16px Inter', padding: '16px 24px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--ink)' }}>
              <span>{x.q}</span><span>{open === i ? '-' : '+'}</span>
            </button>
            {open === i && <div style={{ padding: '0 24px 16px', fontSize: 14, lineHeight: '22px', color: 'var(--text2)' }}>{x.a}</div>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 24 }}>Still need help? <a href="#/contact">Contact us</a>.</p>
    </section>
  );
}

export function Doc({ name }: { name: string }) {
  const { settings: st } = useApp();
  const docs: Record<string, { title: string; sections: { h: string; t: string }[] }> = {
    shipping: { title: 'Shipping and Returns', sections: [
      { h: 'Delivery', t: 'Standard delivery takes 3 to 5 working days and costs ' + money(st.standard) + '. Orders over ' + money(st.freeOver) + ' ship free. Express next working day delivery costs ' + money(st.express) + '.' },
      { h: 'Dispatch', t: 'Orders placed before 1pm on a working day are dispatched the same day. Candles are packed in recycled, protective packaging.' },
      { h: 'Returns', t: 'Unused candles can be returned within 30 days for a full refund. Contact us for a returns label. Damaged items are replaced at no cost.' },
    ] },
    care: { title: 'Candle Care', sections: [
      { h: 'First burn', t: 'Let the wax melt to the edge of the jar on the first burn, usually 2 to 3 hours. This sets the melt pool and prevents tunnelling.' },
      { h: 'Wick', t: 'Trim the wick to 5mm before every burn. Remove any debris from the wax.' },
      { h: 'Safety', t: 'Never leave a burning candle unattended. Keep away from children, pets and draughts. Stop burning when 1cm of wax remains.' },
    ] },
    privacy: { title: 'Privacy Policy', sections: [
      { h: 'What we collect', t: 'Name, email, delivery address and order history, used only to process and deliver your orders and to contact you about them.' },
      { h: 'Cookies', t: 'We store your basket and sign-in on your device. We do not run advertising trackers.' },
      { h: 'Your rights', t: 'You can ask us to export or delete your data at any time by contacting ' + (st.email || 'us') + '.' },
    ] },
    terms: { title: 'Terms of Sale', sections: [
      { h: 'Orders', t: 'An order is accepted when we send a dispatch confirmation. We may cancel and refund an order if an item is out of stock.' },
      { h: 'Pricing', t: 'Prices are in pounds sterling and include VAT where applicable. Delivery is charged at checkout.' },
      { h: 'Returns', t: 'See the Shipping and Returns page for how to return an item.' },
    ] },
  };
  const doc = docs[name];
  return (
    <section className="narrow" style={{ maxWidth: 760 }}>
      <h1 className="h1" style={{ marginBottom: 24 }}>{doc.title}</h1>
      <div className="stack" style={{ gap: 20 }}>
        {doc.sections.map((s) => (
          <div key={s.h}>
            <div className="h3" style={{ marginBottom: 4 }}>{s.h}</div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', color: 'var(--text2)' }}>{s.t}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
export const DOC_KEYS = ['shipping', 'care', 'privacy', 'terms'];

export function Track() {
  const { bind, str } = useForm();
  const [err, setErr] = useState('');

  const submit = async () => {
    let o = get<Order[]>('orders', []).find((x) => x.id.toLowerCase() === str('tkid').trim().toLowerCase() && x.email.toLowerCase() === str('tkemail').trim().toLowerCase());
    if (!o && remote) {
      o = (await fetchOrder(str('tkid'), str('tkemail'))) ?? undefined;
      if (o) setLocal('orders', get<Order[]>('orders', []).filter((x) => x.id !== o!.id).concat(o));
    }
    if (!o) return setErr('We could not find that order. Check the number and email.');
    const mine = get<string[]>('myorders', []);
    if (!mine.includes(o.id)) set('myorders', mine.concat(o.id));
    go('order/' + o.id);
  };

  return (
    <section className="narrow" style={{ maxWidth: 480 }}>
      <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
        <h1 className="h1">Track Your Order</h1>
        <p className="muted" style={{ margin: 0 }}>Enter the order number from your confirmation email, for example EE-1004.</p>
        <div className="fields one">
          <Field label="Order number" {...bind('tkid')} placeholder="EE-1004" />
          <Field label="Email" type="email" {...bind('tkemail')} />
        </div>
        <ErrorText>{err}</ErrorText>
        <button type="submit" className="btn" onClick={submit}>Track Order</button>
      </form>
    </section>
  );
}

export function NotFound() {
  return (
    <section className="page" style={{ textAlign: 'center' }}>
      <h1 className="h1">Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <a href="#/" className="btn">Back to Home</a>
    </section>
  );
}
