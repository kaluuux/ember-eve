import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { remote } from '../remote';
import { useApp } from '../AppContext';
import { go, useCurrentRoute } from '../router';
import { money } from '../store';
import { CartDrawer } from './CartDrawer';
import { QuickViewModal } from './QuickViewModal';
import { FloatingActions, Ico, Newsletter } from './Flair';
import { safeUrl } from '../store';
import { LANGS, setLang, useLang, useT } from '../i18n';

/** Click (or hover on desktop) to open; closes on outside click, Escape, or choosing a link. */
function NavDropdown({ label, active, children }: { label: string; active?: boolean; children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The menu hangs off the header, not the scrolling nav row, so a narrow screen cannot clip it.
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!open) return;
    const btn = ref.current?.querySelector('button')?.getBoundingClientRect();
    const hdr = ref.current?.closest('.header')?.getBoundingClientRect();
    if (btn && hdr) setPos({ left: btn.left - hdr.left - 12, top: btn.bottom - hdr.top });
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="dd" ref={ref} onMouseEnter={() => matchMedia('(hover: hover)').matches && setOpen(true)} onMouseLeave={() => matchMedia('(hover: hover)').matches && setOpen(false)}>
      <button type="button" className={'dd-btn' + (active ? ' on' : '')} aria-current={active ? 'page' : undefined} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{label} <span aria-hidden="true" style={{ fontSize: 10 }}>▾</span></button>
      {open && <div className="dd-menu" role="menu" style={{ left: pos.left, top: pos.top }} onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { settings, categories, liveSeasons, seasonal, cart, wish, user, setCartOpen, toast, cookieAccepted, acceptCookie } = useApp();
  const [hq, setHq] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);
  const r = useCurrentRoute();
  const onShop = r.name === 'shop';
  const seasonalMode = onShop && r.q.seasonal === '1';
  const inCollection = onShop && (!!r.q.cat || seasonalMode);
  const here = (name: string) => (r.name === name ? { className: 'on', 'aria-current': 'page' as const } : {});
  const cartCount = cart.reduce((a, x) => a + x.qty, 0);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // the basket button gives a little nudge whenever something is added
  const prev = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prev.current) { setBump(true); const t = window.setTimeout(() => setBump(false), 700); prev.current = cartCount; return () => window.clearTimeout(t); }
    prev.current = cartCount;
  }, [cartCount]);

  const doSearch = (e: FormEvent) => { e.preventDefault(); go('shop?q=' + encodeURIComponent(hq)); };

  return (
    <>
      <div className="shell">
        <div className="topbar">{t('Free delivery over {amount}', { amount: money(settings.freeOver) })}<span className="hide-sm"> · {t('Hand-poured soy wax candles, made in Sri Lanka')}</span><LangSwitch className="topbar-lang" /></div>
        <header className={'header' + (scrolled ? ' scrolled' : '')}>
          <a href="/" className="brand">
            <img src="/logo.png" alt="" width={42} height={42} style={{ borderRadius: 9999 }} />
            <span>{t('Ember & Eve')}</span>
          </a>
          <nav className="nav" aria-label={t('Main')}>
            <a href="/shop" {...((onShop && !inCollection && !r.q.season) || r.name === 'product' ? { className: 'on', 'aria-current': 'page' as const } : {})}>{t('Shop')}</a>
            <NavDropdown label={t('Our Collection')} active={inCollection}>
              {categories.map((c) => <a key={c.id} role="menuitem" href={'/shop?cat=' + c.id} {...(onShop && r.q.cat === c.id ? { className: 'on', 'aria-current': 'page' as const } : {})}>{c.name.replace(' Candles', '')}</a>)}
              {seasonal.length > 0 && <a role="menuitem" href="/shop?seasonal=1" {...(seasonalMode ? { className: 'on', 'aria-current': 'page' as const } : {})}>{t('Seasonal')}</a>}
            </NavDropdown>
            {liveSeasons.map((x) => <a key={x.id} href={'/shop?season=' + x.id} className={'season-link' + (onShop && !seasonalMode && r.q.season === x.id ? ' on' : '')} {...(onShop && !seasonalMode && r.q.season === x.id ? { 'aria-current': 'page' as const } : {})}>{x.name.replace(' Collection', '')}</a>)}
            <a href="/gifts" {...here('gifts')}>{t('Gift Box')}</a>
            <a href="/track" {...here('track')}>{t('Track Order')}</a>
            <a href="/about" {...here('about')}>{t('About')}</a>
            <a href="/contact" {...here('contact')}>{t('Contact')}</a>
          </nav>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={doSearch} style={{ margin: 0 }} role="search">
              <input className="search" name="hq" value={hq} onChange={(e) => setHq(e.target.value)} placeholder={t('Search candles')} aria-label={t('Search candles')} />
            </form>
            <a href={user ? '/account' : '/login'} style={{ fontSize: 14, fontWeight: 500 }}>{user ? 'Hi, ' + user.name.split(' ')[0] : t('Sign In')}</a>
            <a href="/account?tab=wish" className="hide-sm" style={{ fontSize: 14, fontWeight: 500 }}>{t('Saved ·')}{' '}{wish.length}</a>
            <button type="button" className={'basket-btn' + (bump ? ' bump' : '')} onClick={() => setCartOpen(true)}>{t('Basket ·')}{' '}{cartCount}</button>
          </div>
        </header>

        <main style={{ flex: 1 }}><div key={r.name + '/' + r.arg} className="page-in">{children}</div></main>

        <footer className="footer">
          <div className="foot-main">
            <div className="fbrand-col">
              <div className="fbrand">{t('Ember & Eve')}</div>
              <p>{t('Light up your little moments. Hand-poured soy wax candles, made with care in Sri Lanka.')}</p>
              <Socials settings={settings} />
              <div className="fcontact">
                {settings.email && <a href={'mailto:' + settings.email}>{settings.email}</a>}
                {settings.whatsapp && <a href={'https://wa.me/' + settings.whatsapp} target="_blank" rel="noreferrer">{t('WhatsApp +')}{settings.whatsapp}</a>}
                {settings.pickupAddress && <span>{settings.pickupAddress}</span>}
              </div>
            </div>
            <FooterCol title={t('Shop')} links={[['All Candles', '/shop'], ['Gift Box', '/gifts'], ...(remote && settings.giftCardsOn ? [['Gift Cards', '/gift-cards'] as [string, string]] : []), ['Colour Finder', '/finder']]} />
            <FooterCol title={t('Help')} links={[['FAQ', '/faq'], ['Shipping and Returns', '/shipping'], ['Candle Care', '/care'], ['Track Order', '/track'], ['Contact', '/contact']]} />
            <FooterCol title={t('Company')} links={[['About', '/about'], ['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Staff Login', '/admin']]} />
            <div className="fcol">
              <div className="ftitle">{t('The circle')}</div>
              <div>{t('New collections and offers, once a month.')}</div>
              <Newsletter light />
            </div>
          </div>
          <div className="foot-base">
            <span>{t('© 2026 Ember & Eve')}</span>
            <span>{t('Pay by bank transfer or LankaQR · Delivery across Sri Lanka')}</span>
            <LangSwitch />
          </div>
        </footer>
      </div>

      <FloatingActions />
      <CartDrawer />
      <QuickViewModal />
      {toast && <div className="toast" role="status">{t(toast)}</div>}
      {!cookieAccepted && (
        <div className="cookie" role="dialog" aria-label={t('Cookies')}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 14, lineHeight: '22px' }}>{t('We use cookies to keep your basket and sign-in.')}{' '}<a href="/privacy">{t('Privacy Policy')}</a></div>
          <button type="button" className="btn sm" onClick={acceptCookie}>{t('Accept')}</button>
        </div>
      )}
    </>
  );
}

/** English, Sinhala and Tamil. The choice is remembered on this device. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  return (
    <span className={'lang-switch ' + className} role="group" aria-label="Language">
      {LANGS.map((l) => <button key={l.id} type="button" aria-pressed={lang === l.id} title={l.label} onClick={() => setLang(l.id)}>{l.label}</button>)}
    </span>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  const t = useT();
  return (
    <div className="fcol">
      <div className="ftitle">{t(title)}</div>
      {links.map(([l, h]) => <a key={h} href={h}>{t(l)}</a>)}
    </div>
  );
}

/** Round links to the shop's social profiles. Only profiles that have been filled in appear. */
export function Socials({ settings, dark = true }: { settings: { instagram: string; facebook: string; tiktok: string; youtube: string }; dark?: boolean }) {
  const items = ([['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube']] as const).map(([k, l]) => [k, l, safeUrl(settings[k])] as const).filter(([, , u]) => u);
  if (!items.length) return null;
  return (
    <div className={'socials' + (dark ? '' : ' light')}>
      {items.map(([k, l, u]) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" aria-label={l}><Ico n={k} /></a>)}
    </div>
  );
}
