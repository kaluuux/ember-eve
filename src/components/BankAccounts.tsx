import { useState } from 'react';
import type { BankAccount } from '../types';

/**
 * Choose a bank, then see its LankaQR code and account details.
 * Used at checkout and on the order page.
 */
export function BankAccounts({ accounts, reference }: { accounts: BankAccount[]; reference?: string }) {
  const list = accounts.filter((a) => a.number.trim());
  const [pick, setPick] = useState('');
  const [copied, setCopied] = useState(false);
  if (!list.length) return null;
  const a = list.find((x) => x.id === pick) ?? list[0];
  const copy = () => {
    void navigator.clipboard?.writeText(a.number);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {list.length > 1 && (
        <div>
          <div className="label-s">Choose your bank</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Bank">
            {list.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={x.id === a.id} className={'chip wide' + (x.id === a.id ? ' on' : '')} onClick={() => { setPick(x.id); setCopied(false); }}>{x.bank}</button>
            ))}
          </div>
        </div>
      )}
      <div className="bank-box bank-card">
        <div style={{ fontWeight: 700, fontSize: 16 }}>{a.bank}</div>
        {a.qr ? (
          <>
            <img className="bank-qr" src={a.qr} alt={'LankaQR code for ' + a.bank} />
            <div className="muted" style={{ fontSize: 13 }}>Scan with your bank app (LankaQR), or use the account details below.</div>
          </>
        ) : null}
        {a.branch && <div className="muted">{a.branch}</div>}
        <div>{a.name}</div>
        <div className="row-between" style={{ gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>{a.number}</span>
          <button type="button" className="btn-xs" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
      {reference && <div>Payment reference: <b>{reference}</b></div>}
    </div>
  );
}
