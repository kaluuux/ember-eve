import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useApp } from '../AppContext';
import { go, useCurrentRoute } from '../router';
import { money } from '../store';
import { CartDrawer } from './CartDrawer';
import { QuickViewModal } from './QuickViewModal';
import { FloatingActions, Newsletter } from './Flair';

/** Click (or hover on desktop) to open; closes on outside click, Escape, or choosing a link. */
function NavDropdown({ label, active, children }: { label: string; active?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="dd" ref={ref} onMouseEnter={() => matchMedia('(hover: hover)').matches && setOpen(true)} onMouseLeave={() => matchMedia('(hover: hover)').matches && setOpen(false)}>
      <button type="button" className={'dd-btn' + (active ? ' on' : '')} aria-current={active ? 'page' : undefined} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{label} <span aria-hidden="true" style={{ fontSize: 10 }}>▾</span></button>
      {open && <div className="dd-menu" role="menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
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
        <div className="topbar">Free delivery over {money(settings.freeOver)}<span className="hide-sm"> · Hand-poured soy wax candles, made in Sri Lanka</span></div>
        <header className={'header' + (scrolled ? ' scrolled' : '')}>
          <a href="#/" className="brand">
            <img src="/logo.png" alt="" width={42} height={42} style={{ borderRadius: 9999 }} />
            <span>Ember &amp; Eve</span>
          </a>
          <nav className="nav" aria-label="Main">
            <a href="#/shop" {...((onShop && !inCollection && !r.q.season) || r.name === 'product' ? { className: 'on', 'aria-current': 'page' as const } : {})}>Shop</a>
            <NavDropdown label="Our Collection" active={inCollection}>
              {categories.map((c) => <a key={c.id} role="menuitem" href={'#/shop?cat=' + c.id} {...(onShop && r.q.cat === c.id ? { className: 'on', 'aria-current': 'page' as const } : {})}>{c.name.replace(' Candles', '')}</a>)}
              {seasonal.length > 0 && <a role="menuitem" href="#/shop?seasonal=1" {...(seasonalMode ? { className: 'on', 'aria-current': 'page' as const } : {})}>Seasonal</a>}
            </NavDropdown>
            {liveSeasons.map((x) => <a key={x.id} href={'#/shop?season=' + x.id} className={'season-link' + (onShop && !seasonalMode && r.q.season === x.id ? ' on' : '')} {...(onShop && !seasonalMode && r.q.season === x.id ? { 'aria-current': 'page' as const } : {})}>{x.name.replace(' Collection', '')}</a>)}
            <a href="#/gifts" {...here('gifts')}>Gift Box</a>
            <a href="#/track" {...here('track')}>Track Order</a>
            <a href="#/about" {...here('about')}>About</a>
            <a href="#/contact" {...here('contact')}>Contact</a>
          </nav>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={doSearch} style={{ margin: 0 }} role="search">
              <input className="search" name="hq" value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Search candles" aria-label="Search candles" />
            </form>
            <a href={user ? '#/account' : '#/login'} style={{ fontSize: 14, fontWeight: 500 }}>{user ? 'Hi, ' + user.name.split(' ')[0] : 'Sign In'}</a>
            <a href="#/account?tab=wish" className="hide-sm" style={{ fontSize: 14, fontWeight: 500 }}>Saved · {wish.length}</a>
            <button type="button" className={'basket-btn' + (bump ? ' bump' : '')} onClick={() => setCartOpen(true)}>Basket · {cartCount}</button>
          </div>
        </header>

        <main style={{ flex: 1 }}><div key={r.name + '/' + r.arg} className="page-in">{children}</div></main>

        <footer className="footer">
          <div className="foot-main">
            <div className="fbrand-col">
              <div className="fbrand">Ember &amp; Eve</div>
              <p>Light up your little moments. Hand-poured soy wax candles, made with care in Sri Lanka.</p>
              <div className="fcontact">
                {settings.email && <a href={'mailto:' + settings.email}>{settings.email}</a>}
                {settings.whatsapp && <a href={'https://wa.me/' + settings.whatsapp} target="_blank" rel="noreferrer">WhatsApp +{settings.whatsapp}</a>}
                {settings.pickupAddress && <span>{settings.pickupAddress}</span>}
              </div>
            </div>
            <FooterCol title="Shop" links={[['All Candles', '/shop'], ['Gift Box', '/gifts'], ['Colour Finder', '/finder']]} />
            <FooterCol title="Help" links={[['FAQ', '/faq'], ['Shipping and Returns', '/shipping'], ['Candle Care', '/care'], ['Track Order', '/track'], ['Contact', '/contact']]} />
            <FooterCol title="Company" links={[['About', '/about'], ['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Staff Login', '/admin']]} />
            <div className="fcol">
              <div className="ftitle">The circle</div>
              <div>New collections and offers, once a month.</div>
              <Newsletter light />
            </div>
          </div>
          <div className="foot-base">
            <span>© 2026 Ember &amp; Eve</span>
            <span>Pay by bank transfer or LankaQR · Delivery across Sri Lanka</span>
          </div>
        </footer>
      </div>

      <FloatingActions />
      <CartDrawer />
      <QuickViewModal />
      {toast && <div className="toast" role="status">{toast}</div>}
      {!cookieAccepted && (
        <div className="cookie" role="dialog" aria-label="Cookies">
          <div style={{ flex: 1, minWidth: 200, fontSize: 14, lineHeight: '22px' }}>We use cookies to keep your basket and sign-in. <a href="#/privacy">Privacy Policy</a></div>
          <button type="button" className="btn sm" onClick={acceptCookie}>Accept</button>
        </div>
      )}
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="fcol">
      <div className="ftitle">{title}</div>
      {links.map(([l, h]) => <a key={h} href={'#' + h}>{l}</a>)}
    </div>
  );
}
