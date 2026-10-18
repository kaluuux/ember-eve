import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText } from './ui';
import { useT } from '../i18n';

/** Discount code entry / applied state shared by the basket and checkout summaries. */
export function DiscountBox() {
  const t = useT();
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
        <span>{t('Code')}{' '}<b>{disc}</b>{' '}{t('applied')}</span>
        <button type="button" className="link-btn" onClick={() => setDisc('')}>{t('Remove')}</button>
      </div>
    );
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" style={{ minWidth: 0, flex: 1 }} name="code" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} placeholder={t('Discount code')} aria-label={t('Discount code')} />
        <button type="button" className="btn ghost" style={{ padding: '12px 16px', flex: 'none', whiteSpace: 'nowrap' }} onClick={apply}>{t('Apply')}</button>
      </div>
      <ErrorText>{err}</ErrorText>
    </>
  );
}
