import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './theme.css';
import './glow.css';
import { startSync } from './sync';
import { initLang } from './i18n';
import { installLinkInterceptor, upgradeLegacyHash } from './router';

// a friend's share link (?ref=CODE) is remembered until checkout
try {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) localStorage.setItem('ee_ref', ref.toUpperCase());
} catch { /* ignore */ }
initLang();
upgradeLegacyHash();
installLinkInterceptor();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
