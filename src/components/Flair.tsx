import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useApp } from '../AppContext';
import { get, isEmail, set } from '../store';
import { remote } from '../remote';
import { subscribe } from '../sync';
import type { Subscriber } from '../types';
import { useT } from '../i18n';

/* ---------------------------------------------------------------- reveal */
/** Fades and lifts its children into view once, when they scroll onto the screen. */
export function Reveal({ children, className = '', stagger, delay = 0, style, id }: { children: ReactNode; className?: string; stagger?: boolean; delay?: number; style?: CSSProperties; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div id={id} ref={ref} className={(stagger ? 'stagger ' : 'rv ') + (seen ? 'in ' : '') + className} style={{ transitionDelay: delay ? delay + 'ms' : undefined, ...style }}>{children}</div>;
}

/* ---------------------------------------------------------------- embers */
/** Soft glowing specks drifting upwards, like candle light. Purely decorative. */
export function Embers({ n = 14 }: { n?: number }) {
  return (
    <div className="embers" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const r = (k: number) => ((i * 9301 + k * 49297) % 233280) / 233280;
        return <span key={i} style={{ '--x': Math.round(r(1) * 96 + 2), '--s': 4 + Math.round(r(2) * 7) + 'px', '--t': 7 + Math.round(r(3) * 8) + 's', '--d': -Math.round(r(4) * 14) + 's', '--dx': Math.round((r(5) - 0.5) * 70) + 'px' } as CSSProperties} />;
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- icons */
const P: Record<string, string> = {
  leaf: 'M5 19c0-8 5-14 14-14 0 9-5 14-13 14Zm0 0c2-4 5-7 9-9',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5m0-6a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v6c0 4-2.5 6-6 6-3 0-4.5-1.5-6-4l-1.5-3a1.5 1.5 0 0 1 2.5-1.5L8 13',
  palette: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01',
  gift: 'M4 11h16v9H4v-9Zm-1-4h18v4H3V7Zm9 0v13M12 7c-1.5-3.5-5-3-5-1s3 1 5 1Zm0 0c1.5-3.5 5-3 5-1s-3 1-5 1Z',
  truck: 'M2 6h11v10H2V6Zm11 4h4l3 3v3h-7v-6ZM6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.4 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  up: 'm6 14 6-6 6 6',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3 8 7.5 9.5 4.5-1.5 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2.2 2.2L15.5 10',
  flame: 'M12 3c3.5 4 5 6.6 5 9.2a5 5 0 0 1-10 0C7 9.6 8.500 7 12 3Z',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.5-1.5h.01',
  facebook: 'M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5A.5.5 0 0 1 14 8Z',
  tiktok: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.600 2 4.200 5 4.500',
  youtube: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Zm7 1.5v5l4.5-2.5L10 9.5Z',
  wa: 'M12 3.2a8.8 8.8 0 0 0-7.5 13.4L3.2 21l4.5-1.2A8.8 8.8 0 1 0 12 3.200Zm4.600 11.800c-.2.600-1.200 1.100-1.700 1.100-.4.100-1 .1-3.200-.8-2.700-1.100-4.400-3.800-4.600-4-.1-.2-1.100-1.400-1.100-2.700 0-1.300.7-1.900.9-2.200.2-.2.500-.3.700-.3h.5c.2 0 .4 0 .6.500l.8 2c.1.200.1.400 0 .5l-.4.600-.4.400c-.1.100-.3.300-.1.600.2.300.8 1.300 1.700 2.100 1.200 1 2.200 1.300 2.500 1.500.3.100.5.100.6-.1l.9-1.100c.2-.3.400-.2.600-.1l1.900.9c.3.100.5.200.5.300 0 .1 0 .6-.2 1.100Z',
};
export function Ico({ n, fill }: { n: keyof typeof P; fill?: boolean }) {
  const t = useT();
  return (
    <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]} /></svg>
  );
}

/* -------------------------------------------------------- floating actions */
/** WhatsApp chat shortcut (when a number is set) and a back-to-top button. */
export function FloatingActions() {
  const t = useT();
  const { settings } = useApp();
  const [far, setFar] = useState(false);
  useEffect(() => {
    const on = () => setFar(window.scrollY > 900);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className="fab-col">
      <button type="button" className={'fab top' + (far ? '' : ' hide')} aria-label={t('Back to top')} tabIndex={far ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Ico n="up" /></button>
      {settings.whatsapp && (
        <a className="fab wa" href={'https://wa.me/' + settings.whatsapp + '?text=' + encodeURIComponent('Hi ' + settings.shop + ', I have a question.')} target="_blank" rel="noreferrer" aria-label={t('Chat with us on WhatsApp')}>
          <Ico n="wa" fill /><span className="tip">{t('Chat with us')}</span>
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- newsletter */
export function Newsletter({ light }: { light?: boolean }) {
  const t = useT();
  const { flash } = useApp();
  const [em, setEm] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(em)) return flash('Enter a valid email');
    if (remote) {
      const err = await subscribe(em);
      if (err) return flash(err);
    } else {
      set<Subscriber[]>('subscribers', get<Subscriber[]>('subscribers', []).concat({ email: em, date: new Date().toISOString() }));
    }
    setEm('');
    flash('Welcome to the circle. Thank you.');
  };
  return (
    <form onSubmit={submit} className="news-form" style={light ? { margin: 0 } : undefined}>
      <input type="email" name="nl" value={em} onChange={(e) => setEm(e.target.value)} placeholder={t('Your email address')} aria-label={t('Email for newsletter')} />
      <button type="submit" className="btn">{t('Join')}</button>
    </form>
  );
}
