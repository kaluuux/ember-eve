import { useState } from 'react';
import { useApp } from '../AppContext';
import { remote } from '../remote';
import { money, useStored } from '../store';
import type { Wallet } from '../sync';
import { useT } from '../i18n';

const NO_WALLET: Wallet | null = null;

/** Account tab: store credit, the personal share link and the credit statement. */
export function Rewards() {
  const { settings: st } = useApp();
  const t = useT();
  const w = useStored<Wallet | null>('wallet', NO_WALLET);
  const [copied, setCopied] = useState(false);
  if (!remote) return <div className="card muted">{t('Rewards are available on the online store.')}</div>;
  const link = w?.refCode ? window.location.origin + '/?ref=' + w.refCode : '';
  const share = t('I love {shop} candles. Use my link for {amount} off your first order:', { shop: st.shop, amount: money(st.referralFriend) }) + ' ' + link;
  const rules: string[] = [];
  if (st.referralFriend > 0) rules.push(t('Your friend gets {amount} off their first order.', { amount: money(st.referralFriend) }));
  if (st.referralReward > 0) rules.push(t('You get {amount} store credit when their order is paid.', { amount: money(st.referralReward) }));
  if (st.loyaltyPct > 0) rules.push(t('Every paid order earns you {pct}% back as store credit.', { pct: st.loyaltyPct }));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="wallet">
        <div className="tile"><span className="muted">{t('Store credit')}</span><b>{money(w?.credit ?? 0)}</b><span className="muted" style={{ fontSize: 12 }}>{t('Use it at checkout on any candle')}</span></div>
        {st.referralFriend > 0 && link && (
          <div className="tile"><span className="muted">{t('Your share link')}</span><b className="perk-code" style={{ fontSize: 16, wordBreak: 'break-all' }}>{link.replace(/^https?:\/\//, '')}</b>
            <span style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? t('Copied') : t('Copy link')}</button>
              <a className="btn ghost sm" href={'https://wa.me/?text=' + encodeURIComponent(share)} target="_blank" rel="noreferrer">{t('Share on WhatsApp')}</a>
            </span>
          </div>
        )}
      </div>
      {rules.length > 0 && <div className="card"><div className="h3" style={{ marginBottom: 6 }}>{t('How rewards work')}</div><ul style={{ margin: 0, paddingLeft: 18, lineHeight: '24px' }}>{rules.map((r) => <li key={r}>{r}</li>)}</ul></div>}
      <div className="card">
        <div className="h3" style={{ marginBottom: 8 }}>{t('Credit statement')}</div>
        {!w?.ledger.length ? <div className="muted">{t('Nothing yet.')}</div> : w.ledger.map((l) => (
          <div key={l.id} className="row-between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', gap: 12 }}>
            <span>{l.reason}<div className="muted" style={{ fontSize: 12 }}>{new Date(l.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></span>
            <b style={{ color: l.delta >= 0 ? 'var(--green)' : 'inherit' }}>{l.delta >= 0 ? '+' : ''}{money(l.delta)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
