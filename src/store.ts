import { useMemo, useSyncExternalStore } from 'react';
import type { Discount, Order, OrderStatus, Product, Scent, Settings, User, Wax, Review } from './types';

/**
 * localStorage-backed "demo store". Mirrors the data model of the design prototype
 * (keys are prefixed `ee_`). Swap this module for a real API client when a backend exists.
 */
const P = 'ee_';
const EVT = 'ee-store';

export function get<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(P + k);
    return v === null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
}

export function set<T>(k: string, v: T): T {
  try {
    localStorage.setItem(P + k, JSON.stringify(v));
  } catch {
    /* storage unavailable: keep running without persistence */
  }
  window.dispatchEvent(new Event(EVT));
  return v;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Reactive read of a stored key. `def` must be referentially stable (module constant). */
export function useStored<T>(k: string, def: T): T {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(P + k); } catch { return null; }
  });
  return useMemo(() => {
    if (raw === null) return def;
    try { return JSON.parse(raw) as T; } catch { return def; }
  }, [raw, def]);
}

export const SC: Scent[] = [
  { n: 'Vanilla', f: 'Sweet', tint: '#FEF3C7', note: 'Warm and creamy' },
  { n: 'Strawberry', f: 'Fruity', tint: '#FCE7F3', note: 'Ripe and bright' },
  { n: 'Jasmine', f: 'Floral', tint: '#EDE9FE', note: 'Soft white floral' },
  { n: 'Lavender', f: 'Floral', tint: '#E0E7FF', note: 'Calm and clean' },
  { n: 'Rosemary', f: 'Herbal', tint: '#DCFCE7', note: 'Green and fresh' },
];
export const ALL = SC.map((s) => s.n);
export const WAX: Wax[] = [{ l: 'Soy', add: 0 }, { l: 'Coconut-soy blend', add: 2 }];
export const FAMILIES = ['All', 'Sweet', 'Fruity', 'Floral', 'Herbal'];
export const scentOf = (n: string | undefined): Scent => SC.find((x) => x.n === n) ?? SC[0];

export function money(n: number): string {
  n = Math.round(n * 100) / 100;
  return '£' + (n % 1 === 0 ? n : n.toFixed(2));
}

export const DEFAULT_SETTINGS: Settings = { shop: 'Ember & Eve', email: 'hello@emberandeve.example', standard: 3.5, express: 6, freeOver: 40, giftWrap: 3 };

export const STATUS_COLORS: Record<OrderStatus, [string, string]> = {
  Processing: ['#FEF3C7', '#8A4B00'],
  Dispatched: ['#DBEAFE', '#1E40AF'],
  Delivered: ['#DCFCE7', '#166534'],
  Cancelled: ['#FEE2E2', '#991B1B'],
};

// Stable empty defaults for useStored
export const EMPTY: never[] = [];

function seed() {
  if (get('seeded_v1', false)) return;
  const stock = (l: string, p: number, burn: string, s: number) => ({ l, p, burn, stock: s });
  const mkP = (id: number, name: string, shape: string, blurb: string, desc: string, sizes: Product['sizes']): Product => ({
    id, name, shape, blurb, desc, sizes, scents: ALL.slice(), active: true, featured: true,
  });
  set<Product[]>('products', [
    mkP(1, 'Jar Candle', 'Jar', 'The classic. A glass jar with a cotton wick and a slow, even burn.', 'Hand-poured into a reusable glass jar. A full melt pool in the first burn, and a clean, steady flame to the last centimetre.', [stock('200g', 18, '40 hours', 40), stock('300g', 24, '60 hours', 25)]),
    mkP(2, 'Butterfly Candle', 'Butterfly', 'A small sculpted butterfly, made to sit on a shelf or in a gift box.', 'Moulded and finished by hand. Best displayed lit once, then kept as a keepsake while it lasts.', [stock('80g', 9, '16 hours', 60), stock('120g', 13, '24 hours', 30)]),
    mkP(3, 'Bubble Candle', 'Bubble', 'Stacked spheres that melt down in soft layers.', 'Three poured spheres joined by hand. Each layer burns on its own, so the shape changes as it melts.', [stock('100g', 12, '20 hours', 50), stock('160g', 17, '32 hours', 22)]),
    mkP(4, 'Heart Candle', 'Heart', 'A hand-poured heart for birthdays, thank-yous and anniversaries.', 'A single poured heart with a centred wick. Arrives in a kraft box, ready to give.', [stock('90g', 10, '18 hours', 45), stock('140g', 14, '28 hours', 3)]),
    mkP(5, 'Flower Candle', 'Flower', 'A full bloom of petals, poured in layers and finished by hand.', 'Each petal is shaped while the wax is soft. The wick sits in the centre of the bloom.', [stock('85g', 11, '18 hours', 35), stock('130g', 15, '27 hours', 0)]),
  ]);
  set<Discount[]>('discounts', [
    { code: 'WELCOME10', type: 'pct', value: 10, min: 0, active: true, note: '10% off your order' },
    { code: 'EVE5', type: 'fixed', value: 5, min: 20, active: true, note: '£5 off orders over £20' },
    { code: 'FREESHIP', type: 'ship', value: 0, min: 0, active: true, note: 'Free standard delivery' },
  ]);
  set<Settings>('settings', DEFAULT_SETTINGS);
  const users: User[] = [
    { id: 1, name: 'Demo Customer', email: 'demo@emberandeve.example', password: 'candle123', address: { phone: '07700 900123', first: 'Demo', last: 'Customer', a1: '12 Mill Lane', a2: '', city: 'Leeds', post: 'LS1 4AB' }, joined: '2026-08-02' },
    { id: 2, name: 'Amira Khan', email: 'amira@example.com', password: 'candle123', address: {}, joined: '2026-08-19' },
    { id: 3, name: 'Tom Reed', email: 'tom@example.com', password: 'candle123', address: {}, joined: '2026-09-01' },
    { id: 4, name: 'Priya Shah', email: 'priya@example.com', password: 'candle123', address: {}, joined: '2026-09-14' },
  ];
  set('users', users);
  const day = 86400000, now = Date.now();
  type It = Order['items'][number];
  const it = (name: string, sub: string, qty: number, unit: number, tint: string, pid: number, si: number): It => ({ name, sub, qty, unit, tint, pid, si });
  const mk = (n: number, ago: number, u: User, status: OrderStatus, items: It[]): Order => {
    const sub = items.reduce((a, i) => a + i.unit * i.qty, 0), ship = sub >= 40 ? 0 : 3.5, d = new Date(now - ago * day).toISOString();
    return { id: 'EE-' + n, date: d, email: u.email, name: u.name, phone: '07700 900123', address: { a1: '12 Mill Lane', a2: '', city: 'Leeds', post: 'LS1 4AB' }, items, sub, disc: 0, code: '', ship, shipM: 'standard', wrap: 0, total: sub + ship, status, pay: 'Card ending 4242', note: '', userId: u.id, log: [{ s: 'Placed', d }] };
  };
  set<Order[]>('orders', [
    mk(1001, 12, users[1], 'Delivered', [it('Jar Candle, Lavender', '200g · Soy', 2, 18, '#E0E7FF', 1, 0)]),
    mk(1002, 9, users[2], 'Delivered', [it('Heart Candle, Strawberry', '90g · Soy', 1, 10, '#FCE7F3', 4, 0), it('Butterfly Candle, Jasmine', '80g · Soy', 2, 9, '#EDE9FE', 2, 0)]),
    mk(1003, 6, users[3], 'Dispatched', [it('Bubble Candle, Vanilla', '160g · Coconut-soy blend', 1, 19, '#FEF3C7', 3, 1)]),
    mk(1004, 4, users[0], 'Dispatched', [it('Jar Candle, Rosemary', '300g · Soy', 1, 24, '#DCFCE7', 1, 1), it('Flower Candle, Jasmine', '85g · Soy', 1, 11, '#EDE9FE', 5, 0)]),
    mk(1005, 2, users[1], 'Processing', [it('Butterfly Candle, Vanilla', '120g · Soy', 3, 13, '#FEF3C7', 2, 1)]),
    mk(1006, 0, users[2], 'Processing', [it('Heart Candle, Lavender', '140g · Soy', 1, 14, '#E0E7FF', 4, 1)]),
  ]);
  set<Review[]>('reviews', [
    { id: 1, pid: 1, who: 'Priya, Bristol', stars: 5, q: 'Lavender jar burns evenly and the scent fills the bedroom without being heavy.', date: '2026-09-10', approved: true },
    { id: 2, pid: 1, who: 'Tom, Leeds', stars: 5, q: 'Even melt pool, no tunnelling. The 300g has lasted me two months.', date: '2026-09-02', approved: true },
    { id: 3, pid: 2, who: 'Amira, London', stars: 5, q: 'Too pretty to light, and then it smelled amazing.', date: '2026-09-05', approved: true },
    { id: 4, pid: 3, who: 'Jo, Bath', stars: 4, q: 'Fun to watch it melt in layers. Vanilla is sweet but not sickly.', date: '2026-09-12', approved: true },
    { id: 5, pid: 4, who: 'Sam, York', stars: 5, q: 'Bought as an anniversary gift. It arrived well packed and she loved it.', date: '2026-09-20', approved: true },
    { id: 6, pid: 5, who: 'Lena, Cardiff', stars: 5, q: 'The petals are beautiful in person. Jasmine is soft and fresh.', date: '2026-09-22', approved: true },
  ]);
  set('seeded_v1', true);
}
seed();

export const isEmail = (s: string | undefined) => /^\S+@\S+\.\S+$/.test(s ?? '');
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString('en-GB', opts);
