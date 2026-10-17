import type { Order, OrderItem } from './types';

/** Private cost prices by product id, loaded for the owner only. */
export type Costs = Record<string, number>;
export const NO_COSTS: Costs = {};

/** Money actually collected for an order (after any gift card or store credit). */
export const cashOf = (o: Order): number => o.due ?? o.total;

/** What making this line cost, or null when no cost price is known. */
export function lineCost(i: OrderItem, costs: Costs): number | null {
  if (i.kind === 'giftcard') return 0;
  if (typeof i.cost === 'number') return i.cost * i.qty;
  if (i.box?.length) {
    const parts = i.box.map((c) => costs[String(c.pid)]);
    return parts.some((x) => x === undefined) ? null : parts.reduce((a, b) => a + b, 0) * i.qty;
  }
  const c = costs[String(i.pid)];
  return c === undefined ? null : c * i.qty;
}

/**
 * Gross profit on the candles in an order: what customers paid for them (after discounts) minus what they cost to make.
 * Delivery is left out because it is passed on to the courier, and gift cards are not sales of candles.
 * `known` is false when some line has no cost price yet, so the figure is shown as partial.
 */
export function profitOf(o: Order, costs: Costs): { goods: number; cost: number; profit: number; known: boolean } {
  let goods = 0, cost = 0, known = true;
  o.items.forEach((i) => {
    if (i.kind === 'giftcard') return;
    goods += i.unit * i.qty;
    const c = lineCost(i, costs);
    if (c === null) known = false; else cost += c;
  });
  goods -= (o.disc || 0) + (o.refDisc || 0);
  return { goods, cost, profit: goods - cost, known };
}
