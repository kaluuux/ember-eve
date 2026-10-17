import { useApp } from '../AppContext';
import { Stepper } from './ui';
import { Configurator } from './Configurator';
import { blendValid, normalize, selectionTint, unitPrice } from '../commerce';
import { money } from '../store';

export function QuickViewModal() {
  const { qv, setQv, products, addCandle, colors, settings } = useApp();
  const p = qv ? products.find((x) => x.id === qv.id) : undefined;
  if (!qv || !p) return null;
  const sel = normalize(p, qv.sel, colors);
  const set = (s: typeof sel) => setQv({ id: qv.id, sel: s });
  const close = () => setQv(null);
  const max = p.stock === null ? 10 : Math.max(1, p.stock);
  const unit = unitPrice(p, sel, settings);

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal" role="dialog" aria-label={p.name}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
          <div className="ph ph-art" style={{ backgroundColor: selectionTint(sel, colors), aspectRatio: '1', borderRadius: 18 }}>Image: {p.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="h3">{p.name}</div>
              <button type="button" onClick={close} style={{ font: '500 14px Inter', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>Close</button>
            </div>
            <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--text2)' }}>{p.blurb}</div>
            <Configurator p={p} sel={sel} onChange={set} size="sm" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Stepper small qty={sel.qty} onDec={() => set({ ...sel, qty: Math.max(1, sel.qty - 1) })} onInc={() => set({ ...sel, qty: Math.min(max, sel.qty + 1) })} />
              <div style={{ fontSize: 22, fontWeight: 700 }}>{money(unit * sel.qty)}</div>
            </div>
            <button type="button" className={'btn' + (blendValid(sel) ? '' : ' disabled')} onClick={() => { if (addCandle(qv.id, sel)) close(); }}>Add to Basket</button>
            <a href={'#/product/' + p.id} onClick={close} style={{ fontSize: 14, textAlign: 'center' }}>View full details</a>
          </div>
        </div>
      </div>
    </>
  );
}
