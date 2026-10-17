import { useApp } from '../AppContext';
import { Chip, Ph, Stepper } from './ui';
import { WAX, money, scentOf } from '../store';

export function QuickViewModal() {
  const { qv, setQv, products, addCandle } = useApp();
  const p = qv ? products.find((x) => x.id === qv.id) : undefined;
  if (!qv || !p) return null;
  const upd = (o: Partial<typeof qv>) => setQv((t) => (t ? { ...t, ...o } : t));
  const close = () => setQv(null);
  const z = p.sizes[qv.si];
  const sc = scentOf(qv.scent);

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal" role="dialog" aria-label={p.name}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
          <Ph tint={sc.tint} label={`${p.name}, ${qv.scent}`} ratio="1" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)' }}>{qv.scent} · {sc.note}</div>
              <button type="button" onClick={close} style={{ font: '500 14px Inter', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>Close</button>
            </div>
            <div className="h3">{p.name}</div>
            <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--text2)' }}>{p.blurb}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.scents.map((n) => <Chip key={n} on={n === qv.scent} onClick={() => upd({ scent: n })}>{n}</Chip>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {p.sizes.map((s, i) => (
                <Chip key={s.l} size="lg" on={i === qv.si} onClick={() => upd({ si: i, qty: 1 })}>
                  {s.l} · {money(s.p)}{s.stock <= 0 ? ' · Sold out' : ''}
                </Chip>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WAX.map((w, i) => <Chip key={w.l} size="lg" on={i === qv.wi} onClick={() => upd({ wi: i })}>{w.l}{w.add ? ` (+${money(w.add)})` : ''}</Chip>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Stepper small qty={qv.qty} onDec={() => upd({ qty: Math.max(1, qv.qty - 1) })} onInc={() => upd({ qty: Math.min(Math.max(1, z.stock), qv.qty + 1) })} />
              <div style={{ fontSize: 22, fontWeight: 700 }}>{money((z.p + WAX[qv.wi].add) * qv.qty)}</div>
            </div>
            <button type="button" className="btn" onClick={() => { addCandle(qv.id, qv.scent, qv.si, qv.wi, qv.qty); close(); }}>Add to Basket</button>
            <a href={'#/product/' + p.id} onClick={close} style={{ fontSize: 14, textAlign: 'center' }}>View full details</a>
          </div>
        </div>
      </div>
    </>
  );
}
