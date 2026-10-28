import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { useT } from '../i18n';

const KEY = 'ee_devnotice';
/** Search engines and speed tests never see the pop-up, so it cannot count against the site as an intrusive interstitial. */
const crawler = typeof navigator !== 'undefined' && /bot|crawl|spider|slurp|lighthouse|pagespeed|headlesschrome-ssr/i.test(navigator.userAgent);

/**
 * "The shop is still being built" notice for visitors. The owner switches it on and off, and can change the wording,
 * in Admin > Settings > Site notice. Once closed it stays closed for that visit; changing the wording shows it again.
 */
export function DevNotice() {
  const { settings: st } = useApp();
  const t = useT();
  const stamp = st.devNoticeText.trim();
  const seen = () => { try { return sessionStorage.getItem(KEY) === '1:' + stamp; } catch { return false; } };
  const [closed, setClosed] = useState(seen);
  const btn = useRef<HTMLButtonElement>(null);
  const on = st.devNotice && !closed && !crawler;

  // a changed message is new information, so show it again
  useEffect(() => { setClosed(seen()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [stamp]);
  useEffect(() => {
    if (!on) return;
    btn.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const close = () => {
    try { sessionStorage.setItem(KEY, '1:' + stamp); } catch { /* ignore */ }
    setClosed(true);
  };
  if (!on) return null;

  return (
    <>
      <div className="devnote-scrim" onClick={close} />
      <div className="devnote" role="dialog" aria-modal="true" aria-labelledby="devnote-title" data-nosnippet>
        <div className="devnote-ic" aria-hidden="true">🕯️</div>
        <h2 id="devnote-title" className="devnote-title">{t('We are still getting ready')}</h2>
        <p className="devnote-text">{stamp || t('Ember & Eve is still under development. You are welcome to look around, but some things may not work yet and orders may not be taken. Thank you for your patience.')}</p>
        {st.whatsapp && <a className="devnote-wa" href={'https://wa.me/' + st.whatsapp} target="_blank" rel="noreferrer">{t('Questions? Message us on WhatsApp')}</a>}
        <button ref={btn} type="button" className="btn" onClick={close}>{t('Okay, let me look around')}</button>
      </div>
    </>
  );
}
