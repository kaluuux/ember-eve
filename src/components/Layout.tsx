import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useApp } from '../AppContext';
import { go, useCurrentRoute } from '../router';
import { get, isEmail, money, set } from '../store';
import type { Subscriber } from '../types';
import { CartDrawer } from './CartDrawer';
import { QuickViewModal } from './QuickViewModal';

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
  const { settings, categories, liveSeasons, seasonal, cart, wish, user, setCartOpen, toast, flash, cookieAccepted, acceptCookie } = useApp();
  const [hq, setHq] = useState('');
  const [nl, setNl] = useState('');
  const r = useCurrentRoute();
  const onShop = r.name === 'shop';
  const seasonalMode = onShop && r.q.seasonal === '1';
  const inCollection = onShop && (!!r.q.cat || seasonalMode);
  const here = (name: string) => (r.name === name ? { className: 'on', 'aria-current': 'page' as const } : {});
  const cartCount = cart.reduce((a, x) => a + x.qty, 0);

  const doSearch = (e: FormEvent) => { e.preventDefault(); go('shop?q=' + encodeURIComponent(hq)); };
  const doNews = (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(nl)) return flash('Enter a valid email');
    set<Subscriber[]>('subscribers', get<Subscriber[]>('subscribers', []).concat({ email: nl, date: new Date().toISOString() }));
    setNl('');
    flash('Subscribed. Thank you.');
  };

  return (
    <>
      <div className="shell">
        <div className="topbar">Free delivery over {money(settings.freeOver)} · Hand-poured soy wax candles, made in Sri Lanka</div>
        <header className="header">
          <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="Ember & Eve" width={40} height={40} style={{ borderRadius: 9999 }} />
            <span style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>Ember &amp; Eve</span>
          </a>
          <nav className="nav" aria-label="Main">
            <a href="#/shop" {...((onShop && !inCollection && !r.q.season) || r.name === 'product' ? { className: 'on', 'aria-current': 'page' as const } : {})}>Shop</a>
            <NavDropdown label="Our Collection" active={inCollection}>
              {categories.map((c) => <a key={c.id} role="menuitem" href={'#/shop?cat=' + c.id} {...(onShop && r.q.cat === c.id ? { className: 'on', 'aria-current': 'page' as const } : {})}>{c.name.replace(' Candles', '')}</a>)}
              {seasonal.length > 0 && <a role="menuitem" href="#/shop?seasonal=1" {...(seasonalMode ? { className: 'on', 'aria-current': 'page' as const } : {})}>Seasonal</a>}
            </NavDropdown>
            {liveSeasons.map((x) => <a key={x.id} href={'#/shop?season=' + x.id} style={{ color: '#F2C9A0' }} {...(onShop && !seasonalMode && r.q.season === x.id ? { className: 'on', 'aria-current': 'page' as const } : {})}>{x.name.replace(' Collection', '')}</a>)}
            <a href="#/gifts" {...here('gifts')}>Gift Box</a>
            <a href="#/about" {...here('about')}>About</a>
            <a href="#/contact" {...here('contact')}>Contact</a>
          </nav>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={doSearch} style={{ margin: 0 }} role="search">
              <input className="search" name="hq" value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Search candles" aria-label="Search candles" />
            </form>
            <a href={user ? '#/account' : '#/login'} style={{ fontSize: 14, fontWeight: 500 }}>{user ? 'Hi, ' + user.name.split(' ')[0] : 'Sign In'}</a>
            <a href="#/account?tab=wish" style={{ fontSize: 14, fontWeight: 500 }}>Saved · {wish.length}</a>
            <button type="button" className="basket-btn" onClick={() => setCartOpen(true)}>Basket · {cartCount}</button>
          </div>
        </header>

        <main style={{ flex: 1 }}>{children}</main>

        <footer className="footer">
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 32, fontSize: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: '#fff' }}>Ember &amp; Eve</div>
              <div>Light up your little moments.</div>
            </div>
            <FooterCol title="Shop" links={[['All Candles', '/shop'], ['Gift Box', '/gifts'], ['Colour Finder', '/finder']]} />
            <FooterCol title="Help" links={[['FAQ', '/faq'], ['Shipping and Returns', '/shipping'], ['Candle Care', '/care'], ['Track Order', '/track'], ['Contact', '/contact']]} />
            <FooterCol title="Company" links={[['About', '/about'], ['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Staff Login', '/admin']]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>Newsletter</div>
              <div>New collections and offers, once a month.</div>
              <form onSubmit={doNews} style={{ display: 'flex', gap: 8, margin: 0 }}>
                <input name="nl" value={nl} onChange={(e) => setNl(e.target.value)} placeholder="Email" aria-label="Email for newsletter" style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14 }} />
                <button type="submit" style={{ font: '600 14px Inter', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#A67C52', color: '#1B1D1F', cursor: 'pointer' }}>Join</button>
              </form>
            </div>
          </div>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 24px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: '#CDBFB1' }}>
            © 2026 Ember &amp; Eve. Secure checkout · 30-day returns
          </div>
        </footer>
      </div>

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#fff', fontWeight: 600 }}>{title}</div>
      {links.map(([l, h]) => <a key={h} href={'#' + h}>{l}</a>)}
    </div>
  );
}
