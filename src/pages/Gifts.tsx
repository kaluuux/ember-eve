import { useState } from 'react';
import { useApp } from '../AppContext';
import { Configurator } from '../components/Configurator';
import { Stepper } from '../components/ui';
import { blendValid, defaultSelection, describe, inStock, normalize, selectionTint, unitPrice, type Selection } from '../commerce';
import { money } from '../store';

interface Slot { pid: number; sel: Selection }
const MIN = 2, MAX = 8;

/** Gift box builder: any candle from the live catalogue, each with its own options and colour. Box fee comes from settings. */
export function Gifts() {
  const { active, colors, categories, settings, addLine, flash } = useApp();
  const first = active.filter(inStock)[0];
  const mkSlot = (pid: number): Slot => {
    const p = active.find((x) => x.id === pid) ?? first;
    return { pid: p?.id ?? 0, sel: p ? defaultSelection(p, colors) : { opts: {}, color: '', blend: [], qty: 1 } };
  };
  const [slots, setSlots] = useState<Slot[]>(() => [mkSlot(first?.id ?? 0), mkSlot(first?.id ?? 0), mkSlot(first?.id ?? 0)]);
  const productOf = (pid: number) => active.find((x) => x.id === pid);
  const upd = (i: number, o: Partial<Slot>) => setSlots((t) => t.map((s, j) => (j === i ? { ...s, ...o } : s)));
  const resize = (n: number) => setSlots((t) => (n <= t.length ? t.slice(0, n) : t.concat(Array.from({ length: n - t.length }, () => mkSlot(first?.id ?? 0)))));

  if (!first) {
    return (
      <section id="gifts" className="page-72">
        <h2 className="h2">Build Your Own Gift Box</h2>
        <p className="muted">No candles are available right now. Please check back soon.</p>
      </section>
    );
  }

  const rows = slots.map((s) => {
    const p = productOf(s.pid);
    const sel = p ? normalize(p, s.sel, colors) : s.sel;
    return { s, p, sel, unit: p ? unitPrice(p, sel, settings) : 0 };
  });
  const candles = rows.reduce((a, r) => a + r.unit, 0);
  const total = candles + settings.giftBoxFee;
  const valid = rows.every((r) => r.p && blendValid(r.sel));

  const add = () => {
    if (!valid) return flash('Pick at least 2 colours for every custom blend');
    const key = 'gift-' + Date.now();
    addLine({
      key, pid: 0, name: 'Gift Box (' + rows.length + ' candles)',
      sub: rows.map((r) => r.p!.name + ' [' + describe(r.p!, r.sel, colors) + ']').join('; '),
      unit: total, tint: selectionTint(rows[0].sel, colors), qty: 1,
    });
    flash('Gift box added');
  };

  return (
    <section id="gifts" className="page-72">
      <h2 className="h2">Build Your Own Gift Box</h2>
      <p style={{ margin: '4px 0 24px', fontSize: 16, color: 'var(--muted)' }}>
        Choose any candles, pick each colour, and we pack them in a custom gift box (+{money(settings.giftBoxFee)}). You pay for the candles plus the box.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Candles in the box</span>
        <Stepper small qty={slots.length} onDec={() => resize(Math.max(MIN, slots.length - 1))} onInc={() => resize(Math.min(MAX, slots.length + 1))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
        {rows.map((r, i) => (
          <div key={i} className="card stack" style={{ padding: 16, gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown)' }}>Candle {i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{money(r.unit)}</div>
            </div>
            <div className="ph" style={{ background: selectionTint(r.sel, colors), aspectRatio: '3/2', borderRadius: 8 }}>{r.p?.name}</div>
            <select
              aria-label={'Candle ' + (i + 1)}
              value={r.s.pid}
              onChange={(e) => upd(i, mkSlot(Number(e.target.value)))}
              style={{ font: '500 14px Inter', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--sand)', background: '#fff', color: 'var(--ink)' }}
            >
              {categories.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {active.filter((p) => p.cat === c.id && inStock(p)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
            {r.p && <Configurator p={r.p} sel={r.sel} onChange={(sel) => upd(i, { sel })} size="sm" />}
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 24, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ color: 'var(--muted2)' }}>Candles {money(candles)} + gift box {money(settings.giftBoxFee)}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{money(total)}</div>
        </div>
        <button type="button" className={'btn' + (valid ? '' : ' disabled')} onClick={add}>Add Box to Basket</button>
      </div>
    </section>
  );
}
