import { useMemo, useSyncExternalStore } from 'react';
import { remote } from './remote';
import type { Category, Color, Discount, Group, Order, OrderStatus, Product, Review, Season, Settings, User } from './types';

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

/** Write to this browser's cache only (used when loading data from the server). */
export function setLocal<T>(k: string, v: T): T {
  try {
    localStorage.setItem(P + k, JSON.stringify(v));
  } catch {
    /* storage unavailable: keep running without persistence */
  }
  window.dispatchEvent(new Event(EVT));
  return v;
}

export function clearLocal(k: string) {
  try { localStorage.removeItem(P + k); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

type Push = (k: string, v: unknown) => void;
let push: Push | null = null;
/** The sync layer registers itself here so admin edits are written through to the server. */
export function registerPush(fn: Push) { push = fn; }

export function set<T>(k: string, v: T): T {
  setLocal(k, v);
  push?.(k, v);
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

export const DEFAULT_COLORS: Color[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF' }, { id: 'ivory', name: 'Ivory', hex: '#F6EBD3' },
  { id: 'yellow', name: 'Sunshine', hex: '#FBD85D' }, { id: 'orange', name: 'Orange', hex: '#F59E4B' },
  { id: 'coral', name: 'Coral', hex: '#F27D72' }, { id: 'red', name: 'Red', hex: '#D64545' },
  { id: 'pink', name: 'Blush Pink', hex: '#F7B9CE' }, { id: 'rose', name: 'Rose', hex: '#D9638F' },
  { id: 'purple', name: 'Purple', hex: '#8E6BBF' }, { id: 'lavender', name: 'Lavender', hex: '#C7B6E8' },
  { id: 'blue', name: 'Sky Blue', hex: '#7FB7E6' }, { id: 'teal', name: 'Ocean Teal', hex: '#3FA7A3' },
  { id: 'green', name: 'Leaf Green', hex: '#7CB66B' }, { id: 'sage', name: 'Sage', hex: '#B5C4A1' },
  { id: 'brown', name: 'Cocoa Brown', hex: '#8B5E3C' },
];
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'mold', name: 'Mold Candles', blurb: 'Sculpted shapes, poured in moulds and finished by hand.' },
  { id: 'glass', name: 'Glass Candles', blurb: 'Poured into glass, in two sizes, plain or themed.' },
  { id: 'jar', name: 'Jar Candles', blurb: 'Hexagon and round jars with a steady, even burn.' },
];
export const DEFAULT_SEASONS: Season[] = [
  { id: 'halloween', name: 'Halloween Collection', from: '10-01', to: '10-31', force: '', blurb: 'Spooky shapes for the end of October.' },
  { id: 'christmas', name: 'Christmas Collection', from: '11-01', to: '12-31', force: '', blurb: 'Warm candles for the festive season.' },
  { id: 'valentine', name: 'Valentine Collection', from: '01-25', to: '02-14', force: '', blurb: 'Hand-poured gifts for someone you love.' },
  { id: 'traditional', name: 'Traditional Collection', from: '03-25', to: '04-20', force: '', blurb: 'Coconut shell candles for Avurudu and festive gatherings.' },
];
export const colorOf = (cs: Color[], id: string | undefined): Color => cs.find((c) => c.id === id) ?? cs[0] ?? { id: '', name: '', hex: '#EADFD3' };

export function money(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-LK');
}

export const DEFAULT_SETTINGS: Settings = {
  shop: 'Ember & Eve', email: 'hello@emberandeve.example', standard: 450, express: 900, freeOver: 8000, giftWrap: 300,
  freeColors: 3, extraColorFee: 100, giftBoxFee: 1000, giftBoxes: [], districts: [],
  pickupAddress: '', whatsapp: '', banks: [],
  pay: { card: false, bank: true, whatsapp: false, store: false }, payhereMerchantId: '', payhereSandbox: true,
};

/** Settings saved before a field existed simply lack it; fill in the defaults. */
export const withDefaults = (s: Partial<Settings> | undefined): Settings => ({
  ...DEFAULT_SETTINGS, ...s,
  banks: s?.banks?.length ? s.banks : s?.bank?.number ? [{ id: 'bank1', qr: '', ...s.bank }] : [],
  pay: { ...DEFAULT_SETTINGS.pay, ...s?.pay },
});

export const SL_DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'];

export const STATUS_COLORS: Record<OrderStatus, [string, string]> = {
  Processing: ['#FEF3C7', '#8A4B00'],
  Dispatched: ['#DBEAFE', '#1E40AF'],
  Delivered: ['#DCFCE7', '#166534'],
  Cancelled: ['#FEE2E2', '#991B1B'],
};

// Stable empty defaults for useStored
export const EMPTY: never[] = [];

const FRAG: Group = {
  id: 'frag', label: 'Fragrance',
  // Scented is the default and the listed price; unscented takes Rs 50 off.
  options: [...['Vanilla', 'Lavender', 'Jasmine', 'Rosemary', 'Strawberry'].map((n) => ({ id: n.toLowerCase(), label: n, add: 0 })), { id: 'none', label: 'Unscented', add: -50 }],
};
const GLASS_SIZE: Group = { id: 'size', label: 'Size', options: [{ id: 's', label: 'Small (150g)', add: 0 }, { id: 'l', label: 'Large (300g)', add: 600 }] };

/** The starter catalogue: used by the offline demo and by the admin "Publish starter catalogue" button. */
export function starterCatalog() {
  const day = 86400000, now = Date.now();
  const ago = (d: number) => new Date(now - d * day).toISOString();
  const mk = (id: number, name: string, cat: string, base: number, blurb: string, o: Partial<Product> = {}): Product => ({
    id, name, cat, blurb, desc: blurb + ' Hand-poured in small batches from high quality, non-toxic soy wax, with a cotton wick and careful finishing.',
    base, groups: [], colors: true, custom: true, sticker: cat === 'jar' || cat === 'glass', stock: null, salePct: 0, pins: [], season: '', active: true, featured: false,
    created: ago(90), ...o,
  });
  const products: Product[] = [];
  let id = 1;
  /** Base prices already include the scent; unscented is Rs 50 less. */
  const SC = 50;
  const molds = ['Rose', 'Lotus', 'Heart', 'Butterfly', 'Bubble', 'Flower', 'Pillar', 'Seashell', 'Star', 'Cloud', 'Teddy Bear', 'Tulip'];
  molds.forEach((n, i) => products.push(mk(id++, n + ' Candle', 'mold', 450 + (i % 4) * 100, 'A hand-poured ' + n.toLowerCase() + ', made in the colour you choose.', {
    groups: [FRAG], stock: n === 'Rose' ? 3 : n === 'Cloud' ? 0 : null, salePct: n === 'Tulip' ? 15 : 0, created: ago(i === 3 ? 6 : i === 9 ? 12 : 90), featured: i < 4,
  })));
  products.push(mk(id++, 'Classic Glass Candle', 'glass', 1200, 'Simple and clean in a glass vessel. Scented or unscented.', { groups: [GLASS_SIZE, FRAG], featured: true }));
  products.push(mk(id++, 'Sea Theme Glass Candle', 'glass', 1500, 'Shells and ocean tones layered inside the glass.', { groups: [GLASS_SIZE, FRAG], created: ago(9) }));
  products.push(mk(id++, 'Garden Theme Glass Candle', 'glass', 1500, 'Dried petals and soft greens, poured in layers.', { groups: [GLASS_SIZE, FRAG], salePct: 10 }));
  products.push(mk(id++, 'Hexagon Jar Candle', 'jar', 1400, 'A clear hexagon jar with a slow, even burn.', { groups: [FRAG], featured: true }));
  products.push(mk(id++, 'Round Jar Candle', 'jar', 1600, 'A round jar in clear glass, or a brown jar in white wax.', {
    groups: [
      { id: 'jar', label: 'Jar', options: [{ id: 'clear', label: 'Clear jar', add: 0 }, { id: 'brown', label: 'Brown jar (white only)', add: 0, colors: ['white'] }] },
      FRAG,
    ],
    created: ago(3),
  }));
  const seasonal: [string, string, string, number, string][] = [
    ['halloween', 'Pumpkin Mold Candle', 'mold', 650, 'A little pumpkin for the Halloween table.'],
    ['halloween', 'Haunted Jar Candle', 'jar', 1500, 'Dark tones and a spiced scent in a hexagon jar.'],
    ['christmas', 'Christmas Tree Mold Candle', 'mold', 700, 'A tiered tree, poured and finished by hand.'],
    ['christmas', 'Winter Pine Glass Candle', 'glass', 1600, 'Evergreen layers in glass, made for gifting.'],
    ['valentine', 'Rose Heart Mold Candle', 'mold', 750, 'A heart topped with a rose, for someone you love.'],
    ['valentine', 'Love Letter Glass Candle', 'glass', 1600, 'Soft pinks in glass with a gift-ready finish.'],
    ['traditional', 'Coconut Shell Candle', 'jar', 900, 'Poured into a real coconut shell. A traditional look for any home.'],
    ['traditional', 'Avurudu Lamp Candle', 'mold', 600, 'A lamp-shaped candle for festive gatherings.'],
  ];
  seasonal.forEach(([season, n, cat, base, blurb]) => products.push(mk(id++, n, cat, base, blurb, {
    season, groups: cat === 'glass' ? [GLASS_SIZE, FRAG] : [FRAG], created: ago(season === 'halloween' ? 5 : 40),
  })));
  products.forEach((p) => { if (p.groups.some((g) => g.id === 'frag')) p.base += SC; });
  return {
    products,
    colors: DEFAULT_COLORS,
    categories: DEFAULT_CATEGORIES,
    seasons: DEFAULT_SEASONS,
    settings: DEFAULT_SETTINGS,
    discounts: [
      { code: 'WELCOME10', type: 'pct', value: 10, min: 0, active: true, note: '10% off your order' },
      { code: 'EVE500', type: 'fixed', value: 500, min: 3000, active: true, note: 'Rs 500 off orders over Rs 3,000' },
      { code: 'FREESHIP', type: 'ship', value: 0, min: 0, active: true, note: 'Free standard delivery' },
    ] as Discount[],
  };
}

const SEED_KEY = 'seeded_v5';

function seed() {
  if (remote || get(SEED_KEY, false)) return;
  const day = 86400000, now = Date.now();
  const ago = (d: number) => new Date(now - d * day).toISOString();
  const { products } = starterCatalog();
  set<Product[]>('products', products);
  set<Color[]>('colors', DEFAULT_COLORS);
  set<Category[]>('categories', DEFAULT_CATEGORIES);
  set<Season[]>('seasons', DEFAULT_SEASONS);
  set<Discount[]>('discounts', starterCatalog().discounts);
  set<Settings>('settings', DEFAULT_SETTINGS);
  set('cart', []); set('wish', []);
  if (!get<User[]>('users', []).length) {
    const addr = { phone: '0771234567', first: 'Demo', last: 'Customer', a1: '12 Galle Road', a2: '', city: 'Colombo', post: '00300' };
    set<User[]>('users', [
      { id: 1, name: 'Demo Customer', email: 'demo@emberandeve.example', password: 'candle123', address: addr, joined: '2026-08-02' },
      { id: 2, name: 'Amaya Perera', email: 'amaya@example.com', password: 'candle123', address: {}, joined: '2026-08-19' },
      { id: 3, name: 'Nuwan Silva', email: 'nuwan@example.com', password: 'candle123', address: {}, joined: '2026-09-01' },
      { id: 4, name: 'Dilini Fernando', email: 'dilini@example.com', password: 'candle123', address: {}, joined: '2026-09-14' },
    ]);
  }
  const users = get<User[]>('users', []);
  const u = (i: number) => users[Math.min(i, users.length - 1)];
  type It = Order['items'][number];
  const it = (pid: number, sub: string, qty: number, unit: number, tint: string): It => ({ name: products.find((p) => p.id === pid)?.name ?? '', sub, qty, unit, tint, pid });
  const mkO = (n: number, d: number, us: User, status: OrderStatus, items: It[]): Order => {
    const sub = items.reduce((a, i) => a + i.unit * i.qty, 0), ship = sub >= DEFAULT_SETTINGS.freeOver ? 0 : DEFAULT_SETTINGS.standard, dt = ago(d);
    return { id: 'EE-' + n, date: dt, email: us.email, name: us.name, phone: '0771234567', address: { a1: '12 Galle Road', a2: '', city: 'Colombo', post: '00300' }, items, sub, disc: 0, code: '', ship, shipM: 'standard', wrap: 0, total: sub + ship, status, pay: 'Bank transfer', note: '', userId: us.id, log: [{ s: 'Placed', d: dt }] };
  };
  set<Order[]>('orders', [
    mkO(1001, 40, u(1), 'Delivered', [it(1, 'Fragrance: Unscented · Colour: Rose', 2, 450, '#D9638F'), it(13, 'Size: Small (150g) · Fragrance: Vanilla · Colour: White', 1, 1250, '#FFFFFF')]),
    mkO(1002, 22, u(2), 'Delivered', [it(4, 'Fragrance: Unscented · Colour: Lavender', 3, 450, '#C7B6E8')]),
    mkO(1003, 9, u(3), 'Delivered', [it(16, 'Fragrance: Lavender · Colour: Sage', 2, 1450, '#B5C4A1'), it(1, 'Fragrance: Unscented · Colour: Blush Pink', 1, 450, '#F7B9CE')]),
    mkO(1004, 5, u(0), 'Dispatched', [it(4, 'Fragrance: Unscented · Colour: Sky Blue', 2, 450, '#7FB7E6'), it(14, 'Size: Large (300g) · Fragrance: Unscented · Colour: Ocean Teal', 1, 2100, '#3FA7A3')]),
    mkO(1005, 2, u(1), 'Processing', [it(17, 'Jar: Brown jar (white only) · Fragrance: Jasmine · Colour: White', 1, 1650, '#FFFFFF'), it(3, 'Fragrance: Unscented · Colour: Red', 1, 550, '#D64545')]),
    mkO(1006, 0, u(2), 'Processing', [it(4, 'Fragrance: Unscented · Colour: Coral', 1, 450, '#F27D72')]),
  ]);
  set<Review[]>('reviews', [
    { id: 1, pid: 1, who: 'Amaya, Colombo', stars: 5, q: 'The rose candle is beautiful in person and the colour matched exactly what I picked.', date: '2026-09-10', approved: true },
    { id: 2, pid: 16, who: 'Nuwan, Kandy', stars: 5, q: 'Even melt, no soot, and the lavender is gentle. Great jar.', date: '2026-09-18', approved: true },
    { id: 3, pid: 4, who: 'Dilini, Galle', stars: 5, q: 'Ordered a custom blend for my sister. She loved it.', date: '2026-09-22', approved: true },
    { id: 4, pid: 13, who: 'Sachini, Negombo', stars: 4, q: 'Lovely glass candle. Arrived well packed.', date: '2026-09-25', approved: true },
  ]);
  set(SEED_KEY, true);
}
seed();

export const isEmail = (s: string | undefined) => /^\S+@\S+\.\S+$/.test(s ?? '');
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString('en-GB', opts);
