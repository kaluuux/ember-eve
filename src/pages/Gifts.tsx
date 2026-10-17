import { useState } from 'react';
import { useApp } from '../AppContext';
import { Chip, Ph } from '../components/ui';
import { ALL, scentOf } from '../store';

interface Slot { shape: number; scent: string }

export function Gifts() {
  const { active, products, addLine, flash } = useApp();
  const [slots, setSlots] = useState<Slot[]>([{ shape: 1, scent: 'Vanilla' }, { shape: 2, scent: 'Lavender' }, { shape: 4, scent: 'Strawberry' }]);
  const upd = (i: number, o: Partial<Slot>) => setSlots((t) => t.map((s, j) => (j === i ? { ...s, ...o } : s)));
  const shapeOf = (id: number) => products.find((x) => x.id === id);

  const giftSub = slots.reduce((a, g) => a + (shapeOf(g.shape)?.sizes[0].p ?? 0), 0);
  const giftTotal = Math.round(giftSub * 0.9) + 4;

  const add = () => {
    const key = 'gift-' + slots.map((g) => g.shape + g.scent).join('');
    addLine({ key, pid: 0, si: 0, name: 'Gift Set (3 candles)', sub: slots.map((g) => `${shapeOf(g.shape)?.shape ?? ''} ${g.scent}`).join(', '), unit: giftTotal, tint: '#E0E7FF', qty: 1 });
    flash('Gift set added');
  };

  return (
    <section id="gifts" className="page-72">
      <h2 className="h2">Build Your Own Gift Set</h2>
      <p style={{ margin: '4px 0 24px', fontSize: 16, color: 'var(--muted)' }}>Choose three candles in the smaller size. Sets are 10% off and arrive in a gift box (£4).</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {slots.map((g, i) => (
          <div key={i} className="card stack" style={{ padding: 16, gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown)' }}>Candle {i + 1}</div>
            <Ph tint={scentOf(g.scent).tint} label={`${shapeOf(g.shape)?.name ?? ''}, ${g.scent}`} ratio="3/2" style={{ padding: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)' }}>Shape</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {active.map((p) => <Chip key={p.id} on={p.id === g.shape} onClick={() => upd(i, { shape: p.id })}>{p.shape}</Chip>)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)' }}>Scent</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL.map((n) => <Chip key={n} on={n === g.scent} onClick={() => upd(i, { scent: n })}>{n}</Chip>)}
            </div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ color: 'var(--muted2)' }}>Set total (candles £{giftSub} less 10%, plus box)</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>£{giftTotal}</div>
        </div>
        <button type="button" className="btn" onClick={add}>Add Set to Basket</button>
      </div>
    </section>
  );
}
