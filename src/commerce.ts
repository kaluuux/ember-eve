import type { CartLine, Discount, Order, Product, Settings } from './types';
import { STATUS_COLORS, fmtDate, money } from './store';

export interface Totals {
  sub: number; disc: number; ship: number; wrap: number; total: number; freeLeft: number; freeOver: number; freeShipCode: boolean;
}

export function computeTotals(
  cart: CartLine[], d: Discount | undefined, st: Settings, shipM: 'standard' | 'express' = 'standard', giftWrap = false,
): Totals {
  const sub = cart.reduce((a, l) => a + l.unit * l.qty, 0);
  let disc = 0, freeShipCode = false;
  if (d && sub >= (d.min || 0)) {
    if (d.type === 'pct') disc = Math.round(sub * d.value) / 100;
    else if (d.type === 'fixed') disc = Math.min(d.value, sub);
    else freeShipCode = true;
  }
  const net = sub - disc;
  const ship = sub === 0 ? 0 : shipM === 'express' ? st.express : net >= st.freeOver || freeShipCode ? 0 : st.standard;
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

export const lowestPrice = (p: Product) => Math.min(...p.sizes.map((z) => z.p));
export const inStock = (p: Product) => p.sizes.some((z) => z.stock > 0);
export const firstInStock = (p: Product) => Math.max(0, p.sizes.findIndex((z) => z.stock > 0));

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
