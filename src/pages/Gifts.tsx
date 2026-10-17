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
  const boxes = settings.giftBoxes;
  const [boxId, setBoxId] = useState(boxes[0]?.id ?? '');
  const box = boxes.find((b) => b.id === boxId) ?? boxes[0];
  const [wantNote, setWantNote] = useState(false);
  const [note, setNote] = useState('');
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: box?.slots ?? 3 }, () => mkSlot(first?.id ?? 0)));
  const productOf = (pid: number) => active.find((x) => x.id === pid);
  const upd = (i: number, o: Partial<Slot>) => setSlots((t) => t.map((s, j) => (j === i ? { ...s, ...o } : s)));
  const resize = (n: number) => setSlots((t) => (n <= t.length ? t.slice(0, n) : t.concat(Array.from({ length: n - t.length }, () => mkSlot(first?.id ?? 0)))));

  // a fixed box size sets the number of candles
  if (box && slots.length !== box.slots) resize(box.slots);

  if (!first) {
    return (
      <section id="gifts" className="page-72">
        <h2 className="h2">Create Your Own Gift Box</h2>
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
  const fee = box ? box.fee : settings.giftBoxFee;
  const total = candles + fee;
  const valid = rows.every((r) => r.p && blendValid(r.sel));

  const add = () => {
    if (!valid) return flash('Pick at least 2 colours for every custom blend');
    const key = 'gift-' + Date.now();
    addLine({
      key, pid: 0, name: 'Gift Box (' + rows.length + ' candles)',
      sub: rows.map((r) => r.p!.name + ' [' + describe(r.p!, r.sel, colors) + ']').join('; '),
      unit: total, tint: selectionTint(rows[0].sel, colors), qty: 1,
      box: rows.map((r) => ({ pid: r.p!.id, sel: { opts: r.sel.opts, color: r.sel.color, blend: r.sel.blend, ...(r.sel.sticker?.trim() ? { sticker: r.sel.sticker.trim() } : {}) } })),
      ...(box ? { boxId: box.id } : {}),
      ...(wantNote && note.trim() ? { note: note.trim() } : {}),
    });
    flash('Gift box added');
  };

  return (
    <section id="gifts" className="page-72">
      <h2 className="h2">Create Your Own Gift Box</h2>
      <p style={{ margin: '4px 0 24px', fontSize: 16, color: 'var(--muted)' }}>
        Choose any candles, pick each colour, and we pack them in a custom gift box (+{money(fee)}). You pay for the candles plus the box.
      </p>
      {box ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }} role="radiogroup" aria-label="Box size">
          {boxes.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={b.id === box.id} className={'chip wide' + (b.id === box.id ? ' on' : '')} onClick={() => setBoxId(b.id)}>{b.label || b.slots + ' candles'} · {b.slots} candles · +{money(b.fee)}</button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Candles in the box</span>
          <Stepper small qty={slots.length} onDec={() => resize(Math.max(MIN, slots.length - 1))} onInc={() => resize(Math.min(MAX, slots.length + 1))} />
        </div>
      )}
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
      <div className="card stack" style={{ marginTop: 24, padding: 16, gap: 12 }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <input type="checkbox" checked={wantNote} onChange={(e) => setWantNote(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#8F6642' }} />
          Add a personal note to the gift box
        </label>
        {wantNote && (
          <div className="stack" style={{ gap: 4 }}>
            <textarea className="input" rows={3} maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write the message you would like inside the box" aria-label="Gift box note" />
            <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{note.length}/250</div>
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 16, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ color: 'var(--muted2)' }}>Candles {money(candles)} + gift box {money(fee)}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{money(total)}</div>
        </div>
        <button type="button" className={'btn' + (valid ? '' : ' disabled')} onClick={add}>Add Box to Basket</button>
      </div>
    </section>
  );
}
