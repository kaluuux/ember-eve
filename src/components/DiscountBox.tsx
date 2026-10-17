import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText } from './ui';

/** Discount code entry / applied state shared by the basket and checkout summaries. */
export function DiscountBox() {
  const { disc, setDisc, applyCode, flash } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const apply = async () => {
    const e = await applyCode(code);
    if (e) return setErr(e);
    setErr(''); setCode(''); flash('Code applied');
  };

  if (disc) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, background: 'var(--cream)', borderRadius: 8, padding: '8px 12px' }}>
        <span>Code <b>{disc}</b> applied</span>
        <button type="button" className="link-btn" onClick={() => setDisc('')}>Remove</button>
      </div>
    );
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" name="code" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} placeholder="Discount code" aria-label="Discount code" />
        <button type="button" className="btn ghost" style={{ padding: '12px 16px' }} onClick={apply}>Apply</button>
      </div>
      <ErrorText>{err}</ErrorText>
    </>
  );
}
