import { useState, type ReactNode } from 'react';
import { EMPTY, get, money, set, useStored } from '../store';
import { Chip, ErrorText } from '../components/ui';
import { seasonLive } from '../commerce';
import { remote } from '../remote';
import { PhotoManager } from './PhotoManager';
import { publishStarter, saveCost } from '../sync';
import { NO_COSTS, type Costs } from '../profit';
import type { Category, Color, Group, Opt, Pin, Product, Season } from '../types';

type Flash = (m: string) => void;

const H1 = ({ children }: { children: ReactNode }) => <h1 className="h1">{children}</h1>;
const LBL = { fontSize: 12, fontWeight: 600, color: 'var(--muted2)' } as const;
const uid = () => Math.random().toString(36).slice(2, 8);
const PINS: [Pin, string][] = [['best', 'Best Selling'], ['trending', 'Trending'], ['new', 'New']];

/* ------------------------------------------------------------------- Products */
export function ProductsView({ flash }: { flash: Flash }) {
  const products = useStored<Product[]>('products', EMPTY);
  const categories = useStored<Category[]>('categories', EMPTY);
  const seasons = useStored<Season[]>('seasons', EMPTY);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState(0);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [pct, setPct] = useState('');
  const costs = useStored<Costs>('costs', NO_COSTS);

  const rows = products.filter((p) => (!cat || p.cat === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const patch = (id: number, o: Partial<Product>) => set('products', get<Product[]>('products', []).map((x) => (x.id === id ? { ...x, ...o } : x)));
  const blank = (): Product => ({
    id: 0, name: '', cat: categories[0]?.id ?? '', blurb: '', desc: '', base: 0, groups: [], colors: true, custom: true, sticker: false, stock: null,
    salePct: 0, pins: [], season: '', active: true, featured: false, created: new Date().toISOString(),
  });
  const duplicate = (p: Product) => {
    const all = get<Product[]>('products', []);
    set('products', all.concat({ ...JSON.parse(JSON.stringify(p)), id: Date.now(), name: p.name + ' (copy)', active: false, created: new Date().toISOString(), pins: [] }));
    flash('Duplicated as hidden. Edit and show it when ready.');
  };
  const bulkPrice = () => {
    const n = Number(pct);
    if (!n || n < -90 || n > 500) return flash('Enter a percentage like 10 or -10');
    const ids = new Set(rows.map((p) => p.id));
    set('products', get<Product[]>('products', []).map((p) => (ids.has(p.id) ? { ...p, base: Math.max(1, Math.round(p.base * (1 + n / 100))) } : p)));
    setPct(''); flash('Prices changed for ' + ids.size + ' products');
  };
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v)) || 0));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <H1>Products</H1>
        <button type="button" className="btn" onClick={() => setEditing(blank())}>Add Product</button>
      </div>
      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, padding: 16 }}>
        <input className="input" style={{ width: 200 }} placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <Chip on={!cat} onClick={() => setCat('')}>All</Chip>
        {categories.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
        <div style={{ flex: 1 }} />
        <input className="input" style={{ width: 90 }} placeholder="+10 / -10" aria-label="Percent price change" value={pct} onChange={(e) => setPct(e.target.value)} />
        <button type="button" className="btn-xs" onClick={bulkPrice}>Change prices of {rows.length} shown</button>
      </div>
      <div className="card flush" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Product</th><th>Base price</th><th>Cost</th><th>Sale %</th><th>Stock</th><th>Shelves</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => {
              const se = seasons.find((x) => x.id === p.season);
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>
                    {p.name}
                    <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 400 }}>
                      {categories.find((c) => c.id === p.cat)?.name ?? 'No category'}{se ? ' · ' + se.name + (seasonLive(se) ? ' (live)' : ' (off season)') : ''}
                    </div>
                  </td>
                  <td><input className="input" type="number" min={0} style={{ width: 90 }} aria-label={'Base price ' + p.name} defaultValue={p.base} key={'b' + p.base} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== p.base) patch(p.id, { base: Math.round(v) }); }} /></td>
                  <td>
                    <input className="input" type="number" min={0} style={{ width: 80 }} aria-label={'Cost price ' + p.name} defaultValue={costs[String(p.id)] ?? ''} key={'c' + costs[String(p.id)]} placeholder="Not set" onBlur={(e) => { const v = e.target.value.trim() === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== (costs[String(p.id)] ?? null)) void saveCost(p.id, v).then((m) => m && flash(m)); }} />
                    {costs[String(p.id)] !== undefined && p.base > 0 && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{Math.round(((p.base * (1 - p.salePct / 100) - costs[String(p.id)]) / (p.base * (1 - p.salePct / 100))) * 100)}% margin</div>}
                  </td>
                  <td><input className="input" type="number" min={0} max={90} style={{ width: 70 }} aria-label={'Sale percent ' + p.name} defaultValue={p.salePct || ''} key={'s' + p.salePct} placeholder="0" onBlur={(e) => { const v = Math.min(90, Math.max(0, Math.round(Number(e.target.value) || 0))); if (v !== p.salePct) patch(p.id, { salePct: v }); }} /></td>
                  <td><input className="input" type="number" min={0} style={{ width: 90 }} aria-label={'Stock ' + p.name} defaultValue={p.stock ?? ''} key={'k' + p.stock} placeholder="Made to order" onBlur={(e) => { const v = num(e.target.value); if (v !== p.stock) patch(p.id, { stock: v }); }} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {PINS.map(([k, l]) => <Chip key={k} on={p.pins.includes(k)} onClick={() => patch(p.id, { pins: p.pins.includes(k) ? p.pins.filter((x) => x !== k) : p.pins.concat(k) })}>{l}</Chip>)}
                    </div>
                  </td>
                  <td>
                    <button type="button" className="tag" onClick={() => patch(p.id, { active: !p.active })} style={{ border: 'none', cursor: 'pointer', background: p.active ? '#DCFCE7' : 'var(--sand-l)', color: p.active ? '#166534' : 'var(--muted)' }}>
                      {p.active ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-xs" onClick={() => setEditing(JSON.parse(JSON.stringify(p)))}>Edit</button>{' '}
                    <button type="button" className="btn-xs" onClick={() => duplicate(p)}>Duplicate</button>{' '}
                    <button type="button" className="btn-xs danger" onClick={() => {
                      if (confirm !== p.id) return setConfirm(p.id);
                      set('products', get<Product[]>('products', []).filter((x) => x.id !== p.id)); setConfirm(0); flash('Product deleted');
                    }}>{confirm === p.id ? 'Confirm' : 'Delete'}</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">No products match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Edits to price, sale, stock, shelves and visibility save as you leave each field and show on the storefront straight away. Leave stock empty for made-to-order candles. The cost column is private: it is never shown to customers, and it feeds the profit figures on the dashboard.</p>
      {editing && <ProductEditor product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); flash('Product saved'); }} />}
    </>
  );
}

function ProductEditor({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const categories = useStored<Category[]>('categories', EMPTY);
  const seasons = useStored<Season[]>('seasons', EMPTY);
  const palette = useStored<Color[]>('colors', EMPTY);
  const [d, setD] = useState<Product>(product);
  const costs = useStored<Costs>('costs', NO_COSTS);
  const [cost, setCost] = useState(() => (costs[String(product.id)] !== undefined ? String(costs[String(product.id)]) : ''));
  const [err, setErr] = useState('');
  const up = (o: Partial<Product>) => setD((t) => ({ ...t, ...o }));
  const setGroup = (gi: number, o: Partial<Group>) => up({ groups: d.groups.map((g, i) => (i === gi ? { ...g, ...o } : g)) });
  const setOpt = (gi: number, oi: number, o: Partial<Opt>) => setGroup(gi, { options: d.groups[gi].options.map((x, i) => (i === oi ? { ...x, ...o } : x)) });
  const field = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--muted2)' } as const;

  const save = () => {
    if (!d.name.trim()) return setErr('Name is required.');
    if (!d.cat) return setErr('Choose a category.');
    if (!(d.base > 0)) return setErr('Base price must be above 0.');
    for (const g of d.groups) {
      if (!g.label.trim() || !g.options.length) return setErr('Every option group needs a name and at least one choice.');
      if (g.options.some((o) => !o.label.trim())) return setErr('Every choice needs a label.');
    }
    const clean: Product = { ...d, id: d.id || Date.now(), name: d.name.trim(), base: Math.round(d.base), custom: d.colors && d.custom };
    const all = get<Product[]>('products', []);
    set('products', d.id ? all.map((x) => (x.id === d.id ? clean : x)) : all.concat(clean));
    const cv = cost.trim() === '' ? null : Math.max(0, Math.round(Number(cost) || 0));
    if (cv !== (costs[String(clean.id)] ?? null)) void saveCost(clean.id, cv);
    onSaved();
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal stack" style={{ width: 'min(760px,calc(100vw - 32px))', gap: 16 }} role="dialog" aria-label="Edit product">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="h3">{product.id ? 'Edit ' + product.name : 'New product'}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', font: '500 14px Inter' }}>Close</button>
        </div>
        <div className="fields two">
          <label style={field}>Name<input className="input" value={d.name} onChange={(e) => up({ name: e.target.value })} /></label>
          <label style={field}>Category
            <select className="input" value={d.cat} onChange={(e) => up({ cat: e.target.value })}>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ ...field, gridColumn: 'span 2' }}>Short description<input className="input" value={d.blurb} onChange={(e) => up({ blurb: e.target.value })} /></label>
          <div style={{ ...field, gridColumn: 'span 2' }}>Photos<PhotoManager images={d.images ?? []} onChange={(images) => up({ images })} folder="products" max={8} /></div>
          <label style={{ ...field, gridColumn: 'span 2' }}>Full description<textarea className="input" rows={3} value={d.desc} onChange={(e) => up({ desc: e.target.value })} /></label>
          <label style={field}>Base price (Rs)<input className="input" type="number" min={0} value={d.base || ''} onChange={(e) => up({ base: Number(e.target.value) })} /></label>
          <label style={field}>Cost to make (Rs, private)<input className="input" type="number" min={0} value={cost} placeholder="Not set" onChange={(e) => setCost(e.target.value)} /></label>
          <label style={field}>Sale % (0 = none)<input className="input" type="number" min={0} max={90} value={d.salePct || ''} onChange={(e) => up({ salePct: Math.min(90, Math.max(0, Number(e.target.value) || 0)) })} /></label>
          <label style={field}>Stock (empty = made to order)<input className="input" type="number" min={0} value={d.stock ?? ''} onChange={(e) => up({ stock: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))) })} /></label>
          <label style={field}>Season
            <select className="input" value={d.season} onChange={(e) => up({ season: e.target.value })}>
              <option value="">Year-round</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>

        <div style={LBL}>Options customers choose from (size, fragrance, theme, jar type…). Each choice can add to the price, or take off with a minus (the first choice is the default shown to customers).</div>
        {d.groups.map((g, gi) => (
          <div key={g.id} className="card stack" style={{ padding: 12, gap: 8, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" aria-label="Group name" placeholder="Group name, e.g. Size" value={g.label} onChange={(e) => setGroup(gi, { label: e.target.value })} />
              <button type="button" className="btn-xs danger" onClick={() => up({ groups: d.groups.filter((_, i) => i !== gi) })}>Remove group</button>
            </div>
            {g.options.map((o, oi) => (
              <div key={o.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="input" style={{ flex: '2 1 160px' }} aria-label="Choice label" placeholder="Choice, e.g. Large (300g)" value={o.label} onChange={(e) => setOpt(gi, oi, { label: e.target.value })} />
                <input className="input" style={{ flex: '1 1 90px' }} type="number" aria-label="Price change" placeholder="+/- Rs" value={o.add || ''} onChange={(e) => setOpt(gi, oi, { add: Math.round(Number(e.target.value) || 0) })} />
                <ColorLimit palette={palette} value={o.colors} onChange={(colors) => setOpt(gi, oi, { colors })} />
                <button type="button" className="btn-xs danger" aria-label="Remove choice" onClick={() => setGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}>×</button>
              </div>
            ))}
            <div><button type="button" className="btn-xs" onClick={() => setGroup(gi, { options: g.options.concat({ id: 'o' + uid(), label: '', add: 0 }) })}>Add choice</button></div>
          </div>
        ))}
        <div><button type="button" className="btn-xs" onClick={() => up({ groups: d.groups.concat({ id: 'g' + uid(), label: '', options: [{ id: 'o' + uid(), label: '', add: 0 }] }) })}>Add option group</button></div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip size="lg" on={d.colors} onClick={() => up({ colors: !d.colors })}>Offer colours</Chip>
          <Chip size="lg" on={d.colors && d.custom} onClick={() => up({ custom: !d.custom, colors: true })}>Allow custom colour blend</Chip>
          <Chip size="lg" on={!!d.sticker} onClick={() => up({ sticker: !d.sticker })}>Offer sticker message (free)</Chip>
          <Chip size="lg" on={d.active} onClick={() => up({ active: !d.active })}>Visible in store</Chip>
          <Chip size="lg" on={d.featured} onClick={() => up({ featured: !d.featured })}>Featured</Chip>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={LBL}>Pin to shelf</span>
          {PINS.map(([k, l]) => <Chip key={k} size="lg" on={d.pins.includes(k)} onClick={() => up({ pins: d.pins.includes(k) ? d.pins.filter((x) => x !== k) : d.pins.concat(k) })}>{l}</Chip>)}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>Best Selling, Trending and New fill themselves from orders and launch dates. Pin only to force a candle onto a shelf. Default price shown to customers: {money(Math.round((d.base + d.groups.reduce((a, g) => a + (g.options[0]?.add ?? 0), 0)) * (1 - d.salePct / 100)))}.</div>
        <ErrorText>{err}</ErrorText>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn" onClick={save}>Save Product</button>
        </div>
      </div>
    </>
  );
}

/** Restrict a choice to certain colours (empty = all colours), e.g. brown jar: white only. */
function ColorLimit({ palette, value, onChange }: { palette: Color[]; value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const label = value?.length ? 'Colours: ' + value.length + ' only' : 'All colours';
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn-xs" onClick={() => setOpen(!open)} aria-expanded={open}>{label}</button>
      {open && (
        <div className="card" style={{ position: 'absolute', zIndex: 5, top: '100%', right: 0, width: 260, padding: 12 }}>
          <div className="swatches">
            {palette.map((c) => (
              <button key={c.id} type="button" title={c.name} aria-label={c.name} aria-pressed={!!value?.includes(c.id)} className={'swatch' + (value?.includes(c.id) ? ' on' : '')} style={{ background: c.hex }}
                onClick={() => { const cur = value ?? []; const n = cur.includes(c.id) ? cur.filter((x) => x !== c.id) : cur.concat(c.id); onChange(n.length ? n : undefined); }} />
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Pick the only colours allowed with this choice. None picked means every colour.</div>
          <button type="button" className="btn-xs" style={{ marginTop: 8 }} onClick={() => { onChange(undefined); setOpen(false); }}>Allow all colours</button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- Catalogue (types, colours, seasons) */
export function CatalogView({ flash }: { flash: Flash }) {
  const categories = useStored<Category[]>('categories', EMPTY);
  const colors = useStored<Color[]>('colors', EMPTY);
  const seasons = useStored<Season[]>('seasons', EMPTY);
  const products = useStored<Product[]>('products', EMPTY);
  const row = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const;
  const mdOk = (v: string) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);

  return (
    <>
      <H1>Catalogue setup</H1>
      {remote && products.length === 0 && (
        <div className="card" style={{ margin: '16px 0', background: 'var(--cream)' }}>
          <div className="h3">Your online catalogue is empty</div>
          <p className="muted" style={{ margin: '4px 0 12px' }}>Publish the starter catalogue (types, 15 colours, seasons and sample candles) so customers see a shop, then edit it from the Products page.</p>
          <button type="button" className="btn" onClick={async () => { const e = await publishStarter(); flash(e ? 'Failed: ' + e : 'Starter catalogue published'); }}>Publish starter catalogue</button>
        </div>
      )}
      <p className="muted" style={{ margin: '4px 0 24px' }}>Types, the colour palette and seasonal collections. Changes appear on the storefront straight away.</p>
      <div className="stack" style={{ gap: 24, maxWidth: 820 }}>
        <div className="card stack" style={{ gap: 12 }}>
          <div className="h3">Candle types</div>
          {categories.map((c, i) => {
            const used = products.filter((p) => p.cat === c.id).length;
            return (
              <div key={c.id} style={row}>
                <div style={{ width: 92 }}><PhotoManager compact images={c.image ? [c.image] : []} onChange={(l) => set('categories', categories.map((x, j) => (j === i ? { ...x, image: l[0] ?? '' } : x)))} folder="categories" max={1} /></div>
                <input className="input" style={{ flex: '1 1 160px' }} aria-label="Type name" value={c.name} onChange={(e) => set('categories', categories.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input" style={{ flex: '3 1 240px' }} aria-label="Type description" value={c.blurb} onChange={(e) => set('categories', categories.map((x, j) => (j === i ? { ...x, blurb: e.target.value } : x)))} />
                <button type="button" className="btn-xs danger" onClick={() => used ? flash('Move its ' + used + ' products to another type first') : set('categories', categories.filter((_, j) => j !== i))}>Delete</button>
              </div>
            );
          })}
          <div><button type="button" className="btn-xs" onClick={() => set('categories', categories.concat({ id: 'c' + uid(), name: 'New type', blurb: '' }))}>Add type</button></div>
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <div className="h3">Colour palette</div>
          <div className="muted" style={{ fontSize: 13 }}>Every candle that offers colours shows these. Customers can also blend two or more.</div>
          {colors.map((c, i) => (
            <div key={c.id} style={row}>
              <input type="color" aria-label={'Colour ' + c.name} value={c.hex} onChange={(e) => set('colors', colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))} style={{ width: 40, height: 36, padding: 0, border: '1px solid var(--sand)', borderRadius: 8, background: 'none' }} />
              <input className="input" style={{ flex: '1 1 160px' }} aria-label="Colour name" value={c.name} onChange={(e) => set('colors', colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <button type="button" className="btn-xs danger" onClick={() => colors.length > 2 ? set('colors', colors.filter((_, j) => j !== i)) : flash('Keep at least 2 colours')}>Delete</button>
            </div>
          ))}
          <div><button type="button" className="btn-xs" onClick={() => set('colors', colors.concat({ id: 'k' + uid(), name: 'New colour', hex: '#CCCCCC' }))}>Add colour</button></div>
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <div className="h3">Seasonal collections</div>
          <div className="muted" style={{ fontSize: 13 }}>Candles assigned to a season show on the storefront only inside its dates (MM-DD, for example 11-01 to 12-31), then hide until next year. Use the override to open or close one early. Assign candles to a season in the product editor.</div>
          {seasons.map((s, i) => {
            const patch = (o: Partial<Season>) => set('seasons', seasons.map((x, j) => (j === i ? { ...x, ...o } : x)));
            const bad = !mdOk(s.from) || !mdOk(s.to);
            const n = products.filter((p) => p.season === s.id).length;
            return (
              <div key={s.id} className="stack" style={{ gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                <div style={row}>
                  <input className="input" style={{ flex: '2 1 200px' }} aria-label="Season name" value={s.name} onChange={(e) => patch({ name: e.target.value })} />
                  <input className="input" style={{ width: 80 }} aria-label="From (MM-DD)" value={s.from} onChange={(e) => patch({ from: e.target.value })} />
                  <span>to</span>
                  <input className="input" style={{ width: 80 }} aria-label="To (MM-DD)" value={s.to} onChange={(e) => patch({ to: e.target.value })} />
                  <select className="input" style={{ width: 150 }} aria-label="Override" value={s.force} onChange={(e) => patch({ force: e.target.value as Season['force'] })}>
                    <option value="">Follow dates</option><option value="on">Force on</option><option value="off">Force off</option>
                  </select>
                  <button type="button" className="btn-xs danger" onClick={() => n ? flash('Unassign its ' + n + ' products first') : set('seasons', seasons.filter((_, j) => j !== i))}>Delete</button>
                </div>
                <input className="input" aria-label="Season blurb" placeholder="One line shown on the home page" value={s.blurb} onChange={(e) => patch({ blurb: e.target.value })} />
                <div style={{ fontSize: 12, color: bad ? 'var(--red)' : seasonLive(s) ? 'var(--green)' : 'var(--muted2)' }}>
                  {bad ? 'Dates must look like 11-01.' : (seasonLive(s) ? 'Live now' : 'Hidden now') + ' · ' + n + (n === 1 ? ' candle' : ' candles')}
                </div>
              </div>
            );
          })}
          <div><button type="button" className="btn-xs" onClick={() => set('seasons', seasons.concat({ id: 's' + uid(), name: 'New Collection', from: '01-01', to: '01-31', force: '', blurb: '' }))}>Add season</button></div>
        </div>
      </div>
    </>
  );
}
