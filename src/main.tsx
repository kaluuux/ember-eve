import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
// the admin styles stay in the main stylesheet, in front of the others, so the admin looks exactly as before
import './admin/admin.css';
import './index.css';
import './theme.css';
import './glow.css';
import './mobile.css';
import { startSync } from './sync';
import { initLang } from './i18n';
import { clearShopFiltersOnReload, installLinkInterceptor, upgradeLegacyHash } from './router';

// a friend's share link (?ref=CODE) is remembered until checkout
try {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) localStorage.setItem('ee_ref', ref.toUpperCase());
} catch { /* ignore */ }
upgradeLegacyHash();
clearShopFiltersOnReload();
installLinkInterceptor();
startSync();

/** Visitor statistics skip the admin and the private customer pages (order numbers are in those addresses). */
const PRIVATE = /^\/(admin|account|order|invoice|labels|checkout|reset)(\/|$)/;
const publicOnly = (e: BeforeSendEvent) => { try { return PRIVATE.test(new URL(e.url).pathname) ? null : e; } catch { return e; } };

// English renders straight away; Sinhala or Tamil waits for its word list (a few KB) so nothing flashes in English first
void initLang().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Analytics beforeSend={publicOnly} />
      <SpeedInsights />
    </StrictMode>,
  );
});
