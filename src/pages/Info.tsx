import { useState } from 'react';
import { FAQS } from '../faq-data.js';
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
  const t = useT();

  const contactEmail = st.email || 'support@ember-eve.com';

  const docs: Record<string, {
    title: string;
    subtitle: string;
    effective: string;
    intro?: string;
    sections: { h: string; t: string | string[] }[];
  }> = {
    shipping: {
      title: 'Shipping & Returns',
      subtitle: 'Delivery rates, timelines, store pickup, and our satisfaction guarantee',
      effective: 'Last updated: October 2026',
      intro: 'At Ember & Eve, each candle is artisanally hand-poured in small batches in Sri Lanka. Here is everything you need to know about how your candles are made, packed, and delivered safely to your doorstep.',
      sections: [
        {
          h: '1. Handcrafted Lead Time & Dispatch',
          t: [
            'Every Ember & Eve candle is poured to order to preserve fragrance freshness and artisanal quality. Please allow 2 to 4 working days for hand-pouring, curing, finishing, and quality inspection before your parcel is dispatched.',
            'Production begins promptly once your order and payment verification (such as bank transfer receipt approval) are confirmed.',
          ],
        },
        {
          h: '2. Delivery Rates & Timelines across Sri Lanka',
          t: [
            'Standard Domestic Delivery is ' + money(st.standard) + ' (with district-specific rates calculated transparently at checkout), and is completely free for orders over ' + money(st.freeOver) + '.',
            'Express Delivery is available for ' + money(st.express) + ' for expedited transit.',
            'Once dispatched, standard delivery across Colombo and greater Western Province typically takes 1 to 2 working days. Deliveries to outstation districts typically take 2 to 4 working days via our trusted courier logistics partners.',
            st.pickupAddress ? 'Store Collection: You are also welcome to collect your completed order directly from our studio at ' + st.pickupAddress + ' free of charge once you receive a ready-for-pickup notification.' : '',
          ].filter(Boolean),
        },
        {
          h: '3. Order Tracking',
          t: 'Once your order has been dispatched, you can track delivery progress directly through our online Track Order page using your mobile number and Order ID, or via the tracking link provided by our courier partner.',
        },
        {
          h: '4. Damaged Shipments & 48-Hour Guarantee',
          t: [
            'We package our candles with eco-friendly protective cushioning designed to withstand domestic transport. However, if your package arrives damaged, broken, or defective, please contact us within 48 hours of delivery.',
            'Simply send us your Order ID along with clear photos of the damaged candle and external packaging via WhatsApp or email at ' + contactEmail + '. We will immediately arrange a free replacement or issue a full refund/store credit without hassle.',
          ],
        },
        {
          h: '5. Made-to-Order Cancellation & Return Policy',
          t: 'Because each candle is hand-poured specifically to your chosen shape, colour blend, and scent selection, we cannot accept returns or cancellations for change of mind once pouring has commenced. If you need to make an adjustment or cancel, please contact us as soon as possible before pouring begins.',
        },
      ],
    },

    care: {
      title: 'Candle Care & Safety',
      subtitle: 'Expert guidelines for an even burn, maximum scent throw, and fire safety',
      effective: 'Last updated: October 2026',
      intro: 'Soy wax is a clean, natural, and biodegradable wax that burns at a lower temperature than paraffin. Following these care instructions will ensure your Ember & Eve candles burn cleanly, evenly, and safely for their entire lifespan.',
      sections: [
        {
          h: '1. The Crucial First Burn',
          t: 'Always allow the melted wax pool to reach the full outer perimeter of the container or pillar candle on your very first burn (typically 2 to 3 hours). Soy wax has a "memory" — establishing a full melt pool prevents tunnelling and ensures an even surface throughout subsequent burns.',
        },
        {
          h: '2. Trim Your Wick Before Every Light',
          t: 'Trim the cotton wick to 5mm (1/4 inch) before lighting your candle every single time. A trimmed wick prevents excess mushrooming, soot, smoking, and overly large flames, giving you a calm, clean, and longer burn.',
        },
        {
          h: '3. Essential Fire Safety Protocols',
          t: [
            'Never leave a burning candle unattended. Extinguish all candles when leaving a room or going to sleep.',
            'Keep candles away from drafts, air conditioning vents, open windows, ceiling fans, and flammable household objects like curtains and books.',
            'Always keep candles out of reach of children and household pets.',
            'Place container and pillar candles on a stable, heat-resistant surface or coaster. For sculpted and novelty mould candles, always place a wide-rimmed heat-safe dish underneath to catch cascading melted wax.',
          ],
        },
        {
          h: '4. Safe Extinguishing & Storage',
          t: [
            'Use a candle snuffer or gently dip the wick into the melt pool and straighten it to extinguish the flame without smoke or splatter.',
            'Discontinue use when 1cm (1/2 inch) of wax remains at the bottom of the container to prevent thermal stress on the vessel base.',
            'Store unburned candles in a cool, dry place away from direct sunlight to preserve natural fragrance oils and vibrant colours.',
          ],
        },
      ],
    },

    privacy: {
      title: 'Privacy Policy',
      subtitle: 'Comprehensive disclosure of data collection, processing, Google OAuth, and your rights',
      effective: 'Effective Date: October 27, 2026 • Last updated: October 27, 2026',
      intro: 'Ember & Eve ("we", "us", "our", or "ember-eve.com") is dedicated to safeguarding your privacy and ensuring the security of your personal information. This Privacy Policy details the types of information we collect, how it is used, stored, and protected, and your rights regarding your data when you visit our website, register an account, or purchase our hand-poured candles.',
      sections: [
        {
          h: '1. Information We Collect',
          t: [
            'Personal Information Provided Directly by You: When you browse our store, create an account, place an order, or contact us, you may provide your full name, email address, telephone contact number, physical delivery address, billing details, order notes, and proof-of-payment receipts (such as uploaded bank transfer slips).',
            'Third-Party Authentication (Sign in with Google): When you choose to sign in or register using Google OAuth, Google provides us with your verified basic profile information: full name, email address, and profile picture URL. We only request standard, non-sensitive identity scopes (openid, email, profile). We never request, access, or store your private Google emails, Google Drive files, contacts, search history, or any other private Google service data.',
            'Technical & Usage Data: Our servers automatically collect standard technical logs necessary to serve our website securely, including device type, browser version, operating system, and IP address for security, fraud prevention, and session stability.',
          ],
        },
        {
          h: '2. How We Use Your Information',
          t: [
            'We use the information we collect strictly for legitimate, user-facing operational purposes:',
            '• Account Management: To authenticate your identity, maintain your customer profile, and allow seamless sign-in across visits.',
            '• Order Fulfillment: To process your payments, hand-pour your candles, package your purchases, and deliver physical orders to your shipping address.',
            '• Customer Communication: To send transactional messages, including order confirmation receipts, payment approvals, courier tracking links, and customer support responses.',
            '• Safety & Fraud Prevention: To verify payment receipts, prevent unauthorized transactions, and maintain website security.',
            'We strictly DO NOT use your personal data or Google user credentials to serve third-party advertisements, build behavioral ad profiles, or train artificial intelligence models.',
          ],
        },
        {
          h: '3. Google API Services User Data Policy Compliance',
          t: [
            'Ember & Eve\'s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
            'In strict compliance with Google\'s Limited Use requirements:',
            '• We do not transfer Google user data to external third parties, except as strictly necessary to provide or improve customer-facing features prominent in our application, to comply with applicable law, or as part of a legitimate merger or acquisition.',
            '• We do not use or transfer Google user data to serve advertisements, including personalized, re-targeted, or interest-based advertising.',
            '• Humans do not read user data obtained via Google APIs unless you have given explicit affirmative consent, it is required for security purposes (such as investigating system abuse), or it is necessary to comply with applicable statutory obligations.',
          ],
        },
        {
          h: '4. Data Storage, Security & Protection',
          t: [
            'Your data is securely stored on enterprise-grade cloud database infrastructure provided by Supabase, featuring AES-256 bit encryption at rest and TLS 1.3 cryptographic protocols in transit.',
            'We maintain strict organizational and technical security measures, including role-based access controls and row-level security (RLS), ensuring that customer data is accessible solely to authorized personnel on a strictly need-to-know basis for order fulfillment.',
          ],
        },
        {
          h: '5. Sharing and Disclosure of Information',
          t: [
            'We never sell, rent, lease, trade, or monetize your personal information or Google account credentials to any data brokers, marketers, or third parties under any circumstances.',
            'We disclose data strictly to trusted third-party service partners necessary to operate our store:',
            '• Domestic Courier Logistics: Your recipient name, telephone number, and physical shipping address are shared with registered courier services across Sri Lanka solely to deliver your package.',
            '• Cloud Hosting & Infrastructure: Supabase and Vercel for encrypted database storage and web hosting under strict data processing agreements.',
            '• Legal & Statutory Authorities: We may disclose information only if required by valid court order, subpoena, or applicable legal obligation under Sri Lankan law.',
          ],
        },
        {
          h: '6. Data Retention and Account Deletion Rights',
          t: [
            'We retain your personal data only for as long as your account is active, or as required by statutory accounting, tax, and consumer protection laws.',
            'Your Rights: You have the right to request access to the personal data we hold about you, request corrections to inaccurate details, or request permanent deletion of your account and personal history.',
            'How to Request Account & Data Deletion: You can request complete erasure of your personal data, customer profile, and Google OAuth association at any time by contacting us at ' + contactEmail + ' or through our Contact page. Verified requests are permanently deleted across our active databases within 7 business days.',
          ],
        },
        {
          h: '7. Cookies & Local Storage',
          t: 'We use essential first-party browser local storage and session tokens solely to keep you signed in, remember your shopping basket, and retain your selected language. We do not use third-party tracking cookies, web beacons, or surveillance pixels.',
        },
        {
          h: '8. Protection of Minors',
          t: 'Our website and products are intended for general consumers aged 16 and older. We do not knowingly solicit or collect personal information from children under 13 years of age. If we discover that personal data from a child under 13 has been collected, we will take immediate steps to delete the information.',
        },
        {
          h: '9. Updates to This Policy',
          t: 'We may update this Privacy Policy from time to time to reflect operational, legal, or regulatory changes. Any modifications will be posted directly to this page with an updated Effective Date.',
        },
        {
          h: '10. Contact Us & Data Protection Inquiries',
          t: 'If you have questions, feedback, or wish to exercise your data protection rights, please contact our privacy officer at ' + contactEmail + ' or visit our Contact page. We are located in Sri Lanka.',
        },
      ],
    },

    terms: {
      title: 'Terms of Service',
      subtitle: 'Official terms governing the purchase of hand-poured candles, accounts, and website usage',
      effective: 'Effective Date: October 27, 2026 • Last updated: October 27, 2026',
      intro: 'Welcome to Ember & Eve ("ember-eve.com"). These Terms of Service ("Terms") constitute a legally binding agreement between you and Ember & Eve governing your access to and use of our online store, customer account services, and candle products. Please review these Terms thoroughly before placing an order.',
      sections: [
        {
          h: '1. Agreement to Terms',
          t: 'By accessing our website, creating a customer account, or purchasing any candle, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to all provisions of these Terms, you must discontinue using our services immediately.',
        },
        {
          h: '2. Eligibility & Customer Accounts',
          t: [
            'You must be at least 16 years of age or possess legal parental/guardian consent to make purchases on ember-eve.com.',
            'When creating an account (via email or Google OAuth), you agree to provide truthful, accurate, and complete information. You are solely responsible for maintaining the confidentiality of your login credentials and for all activities conducted under your account.',
          ],
        },
        {
          h: '3. Hand-Poured Artisanal Products & Natural Variations',
          t: [
            'Every Ember & Eve candle is individually hand-poured in small batches in Sri Lanka using 100% natural soy wax, cotton wicks, and curated fragrance oils.',
            'Natural Soy Wax Characteristics: Because our products are hand-poured artisanally, subtle variations in shade, marbling, surface texture, or natural soy frosting are intrinsic characteristics of natural soy wax. These organic variations highlight the authentic handmade nature of each piece and do not constitute defective merchandise.',
          ],
        },
        {
          h: '4. Orders, Customization & Acceptance',
          t: [
            'Placing an order on our website represents an offer to purchase. An order is officially accepted and confirmed once our team verifies and approves your payment.',
            'Custom Candle Options: For candles with custom colour blends, custom scents, or personalized label sticker messages, please review your spelling and options carefully before checkout. Customized candles enter production shortly following payment verification.',
            'We reserve the right to decline, cancel, or refund any order in cases of material shortages, pricing errors, or suspected fraudulent activity.',
          ],
        },
        {
          h: '5. Pricing, Currency & Payment Terms',
          t: [
            'All prices on ember-eve.com are quoted in Sri Lankan Rupees (LKR). Delivery charges are transparently calculated at checkout based on your delivery district.',
            'Payment Methods: We accept direct bank transfer, supported payment cards, and cash on delivery where designated. For bank transfers, customers must upload their official transaction receipt or slip referencing their Order ID. Orders are queued for pouring only after payment verification is confirmed.',
          ],
        },
        {
          h: '6. Production, Curing & Delivery',
          t: [
            'Because our candles are made to order to ensure pristine scent preservation, please allow 2 to 4 business days for pouring, curing, and packaging prior to dispatch.',
            'Deliveries across Sri Lanka are fulfilled via registered courier logistics partners. Delivery timeframes typically range from 1 to 4 working days after dispatch depending on your district.',
          ],
        },
        {
          h: '7. Return, Replacement & Cancellation Policy',
          t: [
            'Made-to-Order Policy: Because each candle is individually hand-crafted to your specific fragrance, colour, and container choices, we do not accept returns, cancellations, or exchanges for change of mind once production has started.',
            'Damaged in Transit Guarantee: If your order arrives damaged, defective, or incorrect, you must notify us within 48 hours of delivery with your Order ID and clear photographic evidence of the damaged candle and parcel packaging. Upon verification, we will promptly dispatch a replacement at zero additional charge or issue a full refund/store credit.',
          ],
        },
        {
          h: '8. Candle Safety Guidelines & User Responsibility (Important Disclaimer)',
          t: [
            'Candles involve open flame and intense heat. Customers agree to burn all candles strictly in accordance with our Candle Care guidelines:',
            '• Never leave a burning candle unattended.',
            '• Keep out of reach of children and pets, and away from drafts, flammable materials, and curtains.',
            '• Always burn candles on a stable, heat-resistant surface. For sculpted and pillar candles, always place a wide-rimmed heat-safe tray or dish underneath to catch melting wax.',
            '• Trim wick to 5mm prior to every burn, and discontinue use when 1cm of wax remains.',
            'Ember & Eve expressly disclaims all liability for property damage, fire, injury, or loss resulting from improper use, neglect, or failure to follow candle safety guidelines.',
          ],
        },
        {
          h: '9. Intellectual Property Rights',
          t: 'All brand names, trademarks, product designs, candle moulds, photographic imagery, graphics, text, and website source code on ember-eve.com are the exclusive intellectual property of Ember & Eve. No material may be reproduced, distributed, or modified without prior written authorization.',
        },
        {
          h: '10. Limitation of Liability',
          t: 'To the maximum extent permitted by applicable law, Ember & Eve\'s total cumulative liability arising out of or related to your use of the website or purchased products shall not exceed the total amount paid by you for the specific order giving rise to the claim.',
        },
        {
          h: '11. Governing Law & Jurisdiction',
          t: 'These Terms of Service and any separate contracts for goods or services provided by Ember & Eve shall be governed by and construed in accordance with the laws of the Democratic Socialist Republic of Sri Lanka.',
        },
        {
          h: '12. Contact Information',
          t: 'Questions regarding these Terms of Service may be addressed to our customer support team at ' + contactEmail + ' or through our Contact page.',
        },
      ],
    },
  };

  const doc = docs[name] ?? docs.privacy;

  return (
    <section className="narrow" style={{ maxWidth: 820, padding: '32px 16px 64px' }}>
      <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'var(--cream)', color: 'var(--brown)', fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Ember & Eve • Official Store Policy
        </div>
        <h1 className="h1" style={{ fontSize: 'clamp(28px, 4vw, 38px)', margin: '0 0 10px', color: 'var(--ink)' }}>{doc.title}</h1>
        <p style={{ fontSize: 16, lineHeight: '24px', color: 'var(--text2)', margin: '0 0 12px' }}>{doc.subtitle}</p>
        <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{doc.effective}</div>
      </div>

      {doc.intro && (
        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--cream)', border: '1px solid var(--line)', marginBottom: 28, fontSize: 15, lineHeight: '24px', color: 'var(--ink)' }}>
          {doc.intro}
        </div>
      )}

      <div className="stack" style={{ gap: 28 }}>
        {doc.sections.map((s) => (
          <article key={s.h} className="card" style={{ padding: 24, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card-bg, #fff)' }}>
            <h2 className="h3" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>{s.h}</h2>
            {Array.isArray(s.t) ? (
              <div className="stack" style={{ gap: 10 }}>
                {s.t.map((p, idx) => (
                  <p key={idx} style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--text2)' }}>{p}</p>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--text2)' }}>{s.t}</p>
            )}
          </article>
        ))}
      </div>

      <div style={{ marginTop: 40, padding: 24, borderRadius: 16, background: 'var(--cream)', textAlign: 'center', border: '1px solid var(--line)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--ink)' }}>{t('Have questions about our policies?')}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text2)' }}>
          {t('Our team is happy to assist with any data inquiries, custom orders, or candle care questions.')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/contact" className="btn" style={{ textDecoration: 'none' }}>{t('Contact Customer Care')}</a>
          <a href={'mailto:' + contactEmail} className="btn-outline" style={{ textDecoration: 'none' }}>{contactEmail}</a>
        </div>
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
