import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, Ph, useForm } from '../components/ui';
import { WhatsInside } from './Home';
import { get, isEmail, money, set } from '../store';
import { remote } from '../remote';
import { sendMessage } from '../sync';
import { Socials } from '../components/Layout';
import type { Message } from '../types';
import { useT } from '../i18n';

const PROCESS = [
  { n: 1, t: 'Melt', d: 'High quality soy wax is melted gently and held at the right temperature.' },
  { n: 2, t: 'Blend', d: 'Your chosen fragrance, if you picked one, and your colours are stirred in.' },
  { n: 3, t: 'Pour', d: 'Each candle is poured by hand, with care and attention to detail, into moulds, glass or jars.' },
  { n: 4, t: 'Set', d: 'Candles rest until they are fully set, then we finish, wrap and send them to you.' },
];

export function About() {
  const t = useT();
  return (
    <>
      <section className="page">
        <div className="layout-half" style={{ alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 16 }}>{t('About Ember & Eve')}</h1>
            <p style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)', margin: '0 0 12px' }}>{t('Light up your little moments. Ember & Eve makes hand-poured candles in Sri Lanka, in small batches and with proper care for every single one.')}</p>
            <p style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)', margin: '0 0 12px' }}>{t('We use high quality soy wax that is non-toxic and gentle on your home. Choose a sculpted mold candle, a glass candle or a jar candle, pick your colour from our palette or blend your own, and add a fragrance if you like.')}</p>
            <p style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)', margin: 0 }}>{t('Giving a gift? Create your own gift box, add a personal note, or add a message on the sticker of a glass or jar candle. Through the year we also pour seasonal collections for Halloween, Christmas, Valentine and the traditional festive season.')}</p>
          </div>
          <Ph tint="#EADFD3" label={t('the maker at work')} ratio="4/3" style={{ borderRadius: 16, border: '1px solid var(--line)' }} />
        </div>
        <h2 className="h2" style={{ margin: '48px 0 24px' }}>{t('How It\'s Made')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {PROCESS.map((s) => (
            <div key={s.n} className="card stack" style={{ padding: 16, gap: 8 }}>
              <Ph tint="#F3EBE1" label={s.t} ratio="3/2" style={{ padding: 8, color: 'var(--muted)' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown)' }}>{t('Step')}{' '}{s.n}</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{t(s.t)}</div>
              <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--muted)' }}>{t(s.d)}</div>
            </div>
          ))}
        </div>
      </section>
      <WhatsInside />
    </>
  );
}

export function Contact() {
  const t = useT();
  const { settings } = useApp();
  const { bind, str, setF } = useForm();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = async () => {
    if (!str('cname').trim() || !isEmail(str('cemail')) || !str('cmsg').trim()) { setOk(''); return setErr('Please complete all fields with a valid email.'); }
    if (str('website')) { setF({}); return setOk('Thank you. We will reply within 2 working days.'); } // honeypot: bots fill the hidden field
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
      <h1 className="h1" style={{ marginBottom: 24 }}>{t('Contact')}</h1>
      <div className="layout-half" style={{ gap: 24, alignItems: 'start' }}>
        <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="h3">{t('Send a message')}</div>
          {ok && <div role="status" style={{ padding: 12, borderRadius: 8, background: 'var(--cream)', color: 'var(--green)', fontWeight: 500 }}>{ok}</div>}
          <div className="fields one">
            <Field label={t('Name')} {...bind('cname')} />
            <Field label={t('Email')} type="email" {...bind('cemail')} />
            <Field label={t('Message')} {...bind('cmsg')} rows={5} />
            <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
              <label>{t('Website')}<input name="website" tabIndex={-1} autoComplete="off" value={str('website')} onChange={(e) => setF((t) => ({ ...t, website: e.target.value }))} /></label>
            </div>
          </div>
          <ErrorText>{err}</ErrorText>
          <div><button type="submit" className="btn" onClick={submit}>{t('Send Message')}</button></div>
        </form>
        <div className="card stack" style={{ gap: 12, fontSize: 14, lineHeight: '22px' }}>
          <div className="h3">{t('Get in touch')}</div>
          <div><b>{t('Email')}</b><br />{settings.email}</div>
          {settings.whatsapp && <div><b>{t('WhatsApp')}</b><br /><a href={'https://wa.me/' + settings.whatsapp} target="_blank" rel="noreferrer">{t('Message us')}</a></div>}
          {settings.pickupAddress && <div><b>{t('Store pickup')}</b><br />{settings.pickupAddress}</div>}
          <div className="muted">{t('We usually reply within 2 working days.')}</div>
          <Socials settings={settings} dark={false} />
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: 'How long do the candles burn?', a: 'Burn time depends on the size and shape: larger candles burn longer. Soy wax burns slowly and evenly. Follow our candle care tips for the best result.' },
  { q: 'What wax do you use?', a: 'High quality soy wax, which is non-toxic and burns cleanly. Every candle is poured by hand.' },
  { q: 'Can I choose the colour?', a: 'Yes. Pick from our colour palette, or choose a custom blend of two or more colours. Some options, like the brown jar, come in white wax only.' },
  { q: 'Can I add a message to my candle?', a: 'Glass and jar candles have a sticker around them. Tick the sticker option on the product page to add a short message or quote, free of charge.' },
  { q: 'Can I send a candle as a gift?', a: 'Yes. Create your own gift box with a personal note, add gift wrap at checkout, or add a gift message for the packing slip.' },
  { q: 'How do I pay?', a: 'Pay by bank transfer using your order number as the reference, then upload your receipt on the order page or send it to us on WhatsApp. We check it, approve your payment and start pouring.' },
  { q: 'Where do you deliver?', a: 'We deliver across Sri Lanka. Delivery is charged by area and is free over a minimum order value shown at checkout. Store pickup is available if the shop offers it.' },
  { q: 'Can I change or cancel my order?', a: 'Open your order page and tap Need to cancel this order, or message us as soon as you can. We can update or cancel an order before it is poured.' },
  { q: 'Are the candles safe for pets?', a: 'Keep all candles and flames out of reach of children and pets, and never leave a burning candle unattended.' },
];

export function Faq() {
  const t = useT();
  const [open, setOpen] = useState(-1);
  return (
    <section className="narrow" style={{ maxWidth: 760 }}>
      <h1 className="h1" style={{ marginBottom: 24 }}>{t('Frequently Asked Questions')}</h1>
      <div className="stack" style={{ gap: 12 }}>
        {FAQS.map((x, i) => (
          <div key={x.q} className="card" style={{ padding: 0 }}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', textAlign: 'left', font: '600 16px Inter', padding: '16px 24px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--ink)' }}>
              <span>{t(x.q)}</span><span>{open === i ? '-' : '+'}</span>
            </button>
            {open === i && <div style={{ padding: '0 24px 16px', fontSize: 14, lineHeight: '22px', color: 'var(--text2)' }}>{t(x.a)}</div>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 24 }}>{t('Still need help?')}{' '}<a href="/contact">{t('Contact us')}</a>.</p>
    </section>
  );
}

export function Doc({ name }: { name: string }) {
  const { settings: st } = useApp();
  const docs: Record<string, { title: string; sections: { h: string; t: string }[] }> = {
    shipping: { title: 'Shipping and Returns', sections: [
      { h: 'Delivery', t: 'Standard delivery is ' + money(st.standard) + ' (some districts have their own rate, shown at checkout) and is free for orders over ' + money(st.freeOver) + '. Express delivery is ' + money(st.express) + '.' + (st.pickupAddress ? ' You can also collect your order from our store.' : '') },
      { h: 'Making and dispatch', t: 'Every candle is hand-poured to order in the colours and options you choose, so please allow a few days for pouring and setting before we dispatch. We start once your payment is approved.' },
      { h: 'Damaged or incorrect items', t: 'Because each candle is made to order, we cannot accept returns for a change of mind. If your candle arrives damaged or not as you ordered, contact us within 48 hours with a photo and we will make it right.' },
    ] },
    care: { title: 'Candle Care', sections: [
      { h: 'First burn', t: 'Let the wax melt to the edge of the container on the first burn, usually 2 to 3 hours. This sets an even melt pool and prevents tunnelling.' },
      { h: 'Wick', t: 'Trim the wick to 5mm before every burn. Remove any debris from the wax.' },
      { h: 'Safety', t: 'Never leave a burning candle unattended. Keep away from children, pets and draughts. Stop burning when 1cm of wax remains.' },
    ] },
    privacy: { title: 'Privacy Policy', sections: [
      { h: 'Information We Collect', t: 'We collect your name, email address, phone number, delivery address, order details, and payment verification receipts. When you choose to sign in using Google, we access your basic Google profile information (name and email address) to authenticate your account.' },
      { h: 'How We Use Your Information', t: 'We use your information exclusively to create and manage your customer account, process orders, deliver purchases, provide order status updates, and respond to your customer service enquiries. We do not use your personal information or Google user data for advertising.' },
      { h: 'Data Storage and Security', t: 'Your data is securely stored in encrypted cloud databases provided by Supabase. We implement strict access controls and security measures to protect your personal details against unauthorized access.' },
      { h: 'Data Sharing and Disclosure', t: 'We never sell, rent, trade, or share your personal information or Google account data with third parties or advertisers. We only share information with courier partners strictly to the extent required to deliver your orders.' },
      { h: 'Data Retention and Account Deletion', t: 'We retain your personal data only for as long as your account is active or needed to provide services. You have the right to request access to your data or request complete account and data deletion at any time by contacting us at ' + (st.email || 'support@ember-eve.com') + '.' },
      { h: 'Cookies and Local Storage', t: 'We only use essential local storage and session tokens to remember your shopping basket and sign-in status across visits. We do not use third-party tracking or advertising cookies.' },
    ] },
    terms: { title: 'Terms of Sale', sections: [
      { h: 'Orders', t: 'An order is confirmed once we have checked and approved your payment. We may cancel and refund an order if an item cannot be made or is out of stock.' },
      { h: 'Pricing', t: 'Prices are in Sri Lankan rupees (LKR). Delivery is charged at checkout. The total you see at checkout is the total you pay.' },
      { h: 'Made to order', t: 'Candles are made to order in your chosen colours and options. See Shipping and Returns for what we do if something goes wrong.' },
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

export function NotFound() {
  const t = useT();
  return (
    <section className="page" style={{ textAlign: 'center' }}>
      <h1 className="h1">{t('Page not found')}</h1>
      <p className="muted">{t('The page you are looking for does not exist.')}</p>
      <a href="/" className="btn">{t('Back to Home')}</a>
    </section>
  );
}
