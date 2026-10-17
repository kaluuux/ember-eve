import type { CartLine, Color, Discount, Order, Product, Season, Settings } from './types';
import { STATUS_COLORS, fmtDate, money } from './store';

export interface Totals {
  sub: number; disc: number; ship: number; wrap: number; total: number; freeLeft: number; freeOver: number; freeShipCode: boolean;
}

export function computeTotals(
  cart: CartLine[], d: Discount | undefined, st: Settings, shipM: 'standard' | 'express' | 'pickup' = 'standard', giftWrap = false, district = '',
): Totals {
  const sub = cart.reduce((a, l) => a + l.unit * l.qty, 0);
  let disc = 0, freeShipCode = false;
  if (d && sub >= (d.min || 0)) {
    if (d.type === 'pct') disc = Math.round(sub * d.value) / 100;
    else if (d.type === 'fixed') disc = Math.min(d.value, sub);
    else freeShipCode = true;
  }
  const net = sub - disc;
  const rate = st.districts.find((x) => x.name.toLowerCase() === district.toLowerCase())?.rate ?? st.standard;
  const ship = sub === 0 || shipM === 'pickup' ? 0 : shipM === 'express' ? st.express : net >= st.freeOver || freeShipCode ? 0 : rate;
  const wrap = giftWrap && sub > 0 ? st.giftWrap : 0;
  return { sub, disc, ship, wrap, total: net + ship + wrap, freeLeft: Math.max(0, st.freeOver - net), freeOver: st.freeOver, freeShipCode };
}

export function freeMessage(t: Totals): string {
  if (t.sub === 0) return 'Free delivery over ' + money(t.freeOver);
  return t.freeLeft > 0 ? 'Add ' + money(t.freeLeft) + ' more for free delivery' : 'You have free delivery';
}

export function ratingOf(reviews: { pid: number; stars: number }[], pid: number) {
  const L = reviews.filter((x) => x.pid === pid);
  return { n: L.length, avg: L.length ? L.reduce((a, x) => a + x.stars, 0) / L.length : 0 };
}

/* ------------------------------------------------------------ options and pricing */
export const CUSTOM = 'custom';
export const STICKER_MAX = 60;
export interface Selection { opts: Record<string, string>; color: string; blend: string[]; qty: number; /** undefined = no sticker message; '' = ticked but not typed yet */ sticker?: string }

/** Colours available for the current option picks (an option can restrict the palette, e.g. brown jar: white only). */
export function allowedColors(p: Product, opts: Record<string, string>, palette: Color[]): Color[] {
  let ids: string[] | null = null;
  p.groups.forEach((g) => {
    const o = g.options.find((x) => x.id === opts[g.id]);
    if (o?.colors?.length) ids = ids ? ids.filter((c) => o.colors!.includes(c)) : o.colors.slice();
  });
  const list = ids ? palette.filter((c) => (ids as string[]).includes(c.id)) : palette;
  return list.length ? list : palette;
}

/** Repair a selection so every pick is valid for the product as it is now. */
export function normalize(p: Product, sel: Partial<Selection>, palette: Color[]): Selection {
  const opts: Record<string, string> = {};
  p.groups.forEach((g) => {
    const want = sel.opts?.[g.id];
    opts[g.id] = g.options.some((o) => o.id === want) ? want! : g.options[0]?.id ?? '';
  });
  const allowed = allowedColors(p, opts, palette);
  const canBlend = p.colors && p.custom && allowed.length >= 2;
  let color = sel.color ?? '';
  if (!p.colors) color = '';
  else if (color === CUSTOM ? !canBlend : !allowed.some((c) => c.id === color)) color = allowed[0]?.id ?? '';
  const blend = (sel.blend ?? []).filter((id) => allowed.some((c) => c.id === id));
  const sticker = p.sticker && sel.sticker !== undefined ? sel.sticker.slice(0, STICKER_MAX) : undefined;
  return { opts, color, blend, qty: Math.max(1, sel.qty ?? 1), sticker };
}

export const defaultSelection = (p: Product, palette: Color[]): Selection => normalize(p, {}, palette);

const optionTotal = (p: Product, opts: Record<string, string>) =>
  p.groups.reduce((a, g) => a + (g.options.find((o) => o.id === opts[g.id])?.add ?? 0), 0);
const afterSale = (p: Product, n: number) => Math.round(n * (1 - (p.salePct || 0) / 100));

/** Price before any sale, without the custom-blend fee */
export const listPrice = (p: Product, sel: Selection) => p.base + optionTotal(p, sel.opts);
export const blendFee = (p: Product, sel: Selection, st: Settings) =>
  sel.color === CUSTOM ? Math.max(0, sel.blend.length - st.freeColors) * st.extraColorFee : 0;
export const unitPrice = (p: Product, sel: Selection, st: Settings) => afterSale(p, listPrice(p, sel)) + blendFee(p, sel, st);
export const blendValid = (sel: Selection) => sel.color !== CUSTOM || sel.blend.length >= 2;

export function describe(p: Product, sel: Selection, palette: Color[]): string {
  const parts = p.groups.map((g) => g.label + ': ' + (g.options.find((o) => o.id === sel.opts[g.id])?.label ?? ''));
  if (p.colors) {
    parts.push('Colour: ' + (sel.color === CUSTOM
      ? 'Custom blend (' + sel.blend.map((id) => palette.find((c) => c.id === id)?.name ?? id).join(' + ') + ')'
      : palette.find((c) => c.id === sel.color)?.name ?? ''));
  }
  if (p.sticker && sel.sticker?.trim()) parts.push('Sticker: "' + sel.sticker.trim() + '"');
  return parts.join(' · ');
}

export function selectionTint(sel: Selection, palette: Color[]): string {
  const id = sel.color === CUSTOM ? sel.blend[0] : sel.color;
  return palette.find((c) => c.id === id)?.hex ?? '#EADFD3';
}

/** Price of the default selection (the first choice in every group, e.g. smallest size, scented). Cards show it as "From". */
export const fromListPrice = (p: Product) => p.base + p.groups.reduce((a, g) => a + (g.options[0]?.add ?? 0), 0);
export const lowestPrice = (p: Product) => afterSale(p, fromListPrice(p));

/** Line description for baskets, orders and the admin: choices plus any gift note. */
export const lineText = (l: { sub: string; note?: string }) => l.sub + (l.note ? ' · Gift note: "' + l.note + '"' : '');
export const inStock = (p: Product) => p.stock === null || p.stock > 0;

/* ------------------------------------------------------------------- seasons */
const md = (d: Date) => String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function seasonLive(s: Season, now = new Date()): boolean {
  if (s.force === 'on') return true;
  if (s.force === 'off') return false;
  const t = md(now);
  return s.from <= s.to ? t >= s.from && t <= s.to : t >= s.from || t <= s.to;
}
/** Products a customer may see: active, and not in a season that is currently closed */
export function visibleProducts(products: Product[], seasons: Season[], now = new Date()): Product[] {
  const live = new Set(seasons.filter((s) => seasonLive(s, now)).map((s) => s.id));
  return products.filter((p) => p.active && (!p.season || live.has(p.season)));
}

/* -------------------------------------------------------------------- shelves */
export type Shelf = 'best' | 'trending' | 'new' | 'sale';
export const SHELVES: { id: Shelf; title: string; blurb: string }[] = [
  { id: 'best', title: 'Best Selling', blurb: 'The candles our customers come back for.' },
  { id: 'trending', title: 'Trending Now', blurb: 'What people are ordering this month.' },
  { id: 'new', title: 'New Launched', blurb: 'Fresh from the pouring table.' },
  { id: 'sale', title: 'On Sale', blurb: 'Hand-poured, for less.' },
];
const DAY = 86400000;

/** Units sold per product: all time and the last 30 days. Built from orders (offline demo) or the server's sales summary. */
export type Sales = Record<number, { all: number; recent: number }>;
export function salesFromOrders(orders: Order[], now = Date.now()): Sales {
  const u: Sales = {};
  orders.forEach((o) => {
    if (o.status === 'Cancelled') return;
    const recent = now - new Date(o.date).getTime() <= 30 * DAY;
    o.items.forEach((i) => {
      if (!i.pid) return;
      const e = (u[i.pid] ??= { all: 0, recent: 0 });
      e.all += i.qty;
      if (recent) e.recent += i.qty;
    });
  });
  return u;
}

export function shelfProducts(kind: Shelf, visible: Product[], sales: Sales, now = Date.now()): Product[] {
  if (kind === 'sale') return visible.filter((p) => p.salePct > 0).sort((a, b) => b.salePct - a.salePct);
  if (kind === 'new') {
    return visible.filter((p) => p.pins.includes('new') || now - new Date(p.created).getTime() <= 30 * DAY)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }
  const units = (id: number) => (kind === 'best' ? sales[id]?.all : sales[id]?.recent) ?? 0;
  const pinned = visible.filter((p) => p.pins.includes(kind));
  const ranked = visible.filter((p) => !p.pins.includes(kind) && units(p.id) > 0).sort((a, b) => units(b.id) - units(a.id));
  return pinned.concat(ranked);
}

export function orderView(o: Order) {
  const rank = ({ Processing: 1, Dispatched: 2, Delivered: 3, Cancelled: 0 } as const)[o.status] ?? 0;
  const cancelled = o.status === 'Cancelled';
  const [statusBg, statusFg] = STATUS_COLORS[o.status] ?? ['#EADFD3', '#26292B'];
  const labels = ['Placed', 'Processing', 'Dispatched', 'Delivered'];
  return {
    ...o,
    statusBg, statusFg,
    count: o.items.reduce((a, i) => a + i.qty, 0),
    dateL: fmtDate(o.date),
    addr: [o.address.a1, o.address.a2, o.address.city, o.address.post].filter(Boolean).join(', '),
    shipName: o.shipM === 'express' ? 'Express' : 'Standard',
    shipL: o.ship === 0 ? 'Free' : money(o.ship),
    timeline: labels.map((l, i) => ({
      label: cancelled && i > 0 ? (i === 1 ? 'Cancelled' : '') : l,
      bg: cancelled ? (i === 0 ? '#8F6642' : i === 1 ? '#CC0000' : '#EADFD3') : i <= rank ? '#8F6642' : '#EADFD3',
      fg: cancelled ? '#26292B' : i <= rank ? '#26292B' : '#8C7B6E',
    })),
  };
}
