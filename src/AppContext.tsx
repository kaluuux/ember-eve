import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { tr } from './i18n';
import type { CartLine, Category, Color, Discount, Order, Product, Review, Season, Session, Settings, User } from './types';
import { DEFAULT_SETTINGS, EMPTY, get, set, useStored, withDefaults } from './store';
import { computeTotals, describe, normalize, selectionTint, salesFromOrders, shelfProducts, unitPrice, visibleProducts, blendValid, type Selection, type Shelf, type Totals } from './commerce';
import { go } from './router';
import { remote } from './remote';
import { checkDiscount, customerSignOut } from './sync';
import type { Sales } from './commerce';

export interface QuickView { id: number; sel: Selection }

interface Ctx {
  products: Product[];
  /** Products a customer can see right now (active, season open) */
  active: Product[];
  colors: Color[];
  categories: Category[];
  seasons: Season[];
  liveSeasons: Season[];
  /** Every active seasonal candle, including seasons that are closed right now (for the Seasonal browse page) */
  seasonal: Product[];
  shelf: (kind: Shelf) => Product[];
  settings: Settings;
  reviews: Review[];
  cart: CartLine[];
  wish: number[];
  user: Session | null;
  disc: string;
  setDisc: (code: string) => void;
  /** Validate and apply a code (server-checked when online). Resolves to an error message or ''. */
  applyCode: (code: string) => Promise<string>;
  discObj: Discount | undefined;
  totals: Totals;
  toast: string;
  flash: (m: string) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  qv: QuickView | null;
  setQv: (q: QuickView | null | ((q: QuickView | null) => QuickView | null)) => void;
  addCandle: (pid: number, sel: Selection) => boolean;
  addLine: (line: CartLine) => void;
  /** Put an earlier order's candles back in the basket. Returns how many lines were added. */
  reorder: (o: Order) => number;
  setQty: (key: string, delta: number) => void;
  clearCart: () => void;
  toggleWish: (id: number) => void;
  signIn: (u: User | Session) => void;
  signOut: () => void;
  cookieAccepted: boolean;
  acceptCookie: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
};

const NO_SESSION: Session | null = null;
const NO_SALES: Sales = {};

export function AppProvider({ children }: { children: ReactNode }) {
  const products = useStored<Product[]>('products', EMPTY);
  const colors = useStored<Color[]>('colors', EMPTY);
  const categories = useStored<Category[]>('categories', EMPTY);
  const seasons = useStored<Season[]>('seasons', EMPTY);
  const orders = useStored<Order[]>('orders', EMPTY);
  const salesStored = useStored<Sales>('sales', NO_SALES);
  const settingsRaw = useStored<Settings>('settings', DEFAULT_SETTINGS);
  const settings = useMemo(() => withDefaults(settingsRaw), [settingsRaw]);
  const reviewsAll = useStored<Review[]>('reviews', EMPTY);
  const discounts = useStored<Discount[]>('discounts', EMPTY);
  const cart = useStored<CartLine[]>('cart', EMPTY);
  const wish = useStored<number[]>('wish', EMPTY);
  const user = useStored<Session | null>('session', NO_SESSION);
  const cookieAccepted = useStored<boolean>('cookie', false);

  const [disc, setDiscCode] = useState('');
  const [remoteDisc, setRemoteDisc] = useState<Discount | undefined>();
  const setDisc = useCallback((c: string) => { setDiscCode(c); if (!c) setRemoteDisc(undefined); }, []);
  const [toast, setToast] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [qv, setQv] = useState<QuickView | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 2000);
  }, []);

  const active = useMemo(() => visibleProducts(products, seasons), [products, seasons]);
  const seasonal = useMemo(() => products.filter((p) => p.active && p.season), [products]);
  const liveSeasons = useMemo(() => seasons.filter((x) => active.some((p) => p.season === x.id)), [seasons, active]);
  const sales = useMemo(() => (remote ? salesStored : salesFromOrders(orders)), [salesStored, orders]);
  const shelf = useCallback((kind: Shelf) => shelfProducts(kind, active, sales), [active, sales]);
  const reviews = useMemo(() => reviewsAll.filter((r) => r.approved), [reviewsAll]);
  const discObj = useMemo(() => (remote ? remoteDisc : discounts.find((d) => d.active && d.code === disc)), [discounts, disc, remoteDisc]);
  const totals = useMemo(() => computeTotals(cart, discObj, settings), [cart, discObj, settings]);

  const addLine = useCallback((line: CartLine) => {
    const c = get<CartLine[]>('cart', []).slice();
    const i = c.findIndex((x) => x.key === line.key);
    if (i >= 0) c[i] = { ...c[i], qty: Math.min(10, c[i].qty + line.qty) };
    else c.push(line);
    set('cart', c);
  }, []);

  const addCandle: Ctx['addCandle'] = useCallback((pid, raw) => {
    const p = get<Product[]>('products', []).find((x) => x.id === pid);
    if (!p) return false;
    const palette = get<Color[]>('colors', []);
    const st = withDefaults(get<Settings>('settings', DEFAULT_SETTINGS));
    const sel = normalize(p, raw, palette);
    if (!blendValid(sel)) { flash('Pick at least 2 colours for a custom blend'); return false; }
    const key = [pid, JSON.stringify(sel.opts), sel.color, sel.blend.join('+'), sel.sticker?.trim() ?? ''].join('|');
    const cur = get<CartLine[]>('cart', []).slice();
    const i = cur.findIndex((x) => x.key === key);
    const have = cur.filter((x) => x.pid === pid).reduce((a, x) => a + x.qty, 0);
    const room = p.stock === null ? 10 : p.stock - have;
    const n = Math.min(sel.qty, room);
    if (n <= 0) { flash(p.stock === 0 ? 'Sold out' : tr('Only {n} in stock', { n: p.stock ?? 0 })); return false; }
    if (i >= 0) cur[i] = { ...cur[i], qty: cur[i].qty + n };
    else cur.push({ key, pid, sel: { opts: sel.opts, color: sel.color, blend: sel.blend, ...(sel.sticker?.trim() ? { sticker: sel.sticker.trim() } : {}) }, name: p.name, sub: describe(p, sel, palette), unit: unitPrice(p, sel, st), tint: selectionTint(sel, palette), ...(p.images?.[0] ? { img: p.images[0] } : {}), qty: n });
    set('cart', cur);
    flash(n < sel.qty ? tr('Added {n} (stock limit)', { n }) : 'Added to basket');
    return true;
  }, [flash]);

  const setQty: Ctx['setQty'] = useCallback((key, d) => {
    const cur = get<CartLine[]>('cart', []).slice();
    const i = cur.findIndex((x) => x.key === key);
    if (i < 0) return;
    const l = cur[i];
    if (l.kind === 'giftcard' && d > 0) { flash('Add another gift card for each one you want to send.'); return; }
    const others = cur.filter((x, j) => j !== i && x.pid === l.pid).reduce((a, x) => a + x.qty, 0);
    const stock = l.pid ? get<Product[]>('products', []).find((p) => p.id === l.pid)?.stock : null;
    const max = l.pid && stock !== null && stock !== undefined ? stock - others : 10;
    let q = l.qty + d;
    if (q > max) { flash(tr('Only {n} available', { n: max })); q = max; }
    if (q <= 0) cur.splice(i, 1); else cur[i] = { ...l, qty: q };
    set('cart', cur);
  }, [flash]);

  const clearCart = useCallback(() => { set('cart', []); setDisc(''); }, [setDisc]);

  const applyCode = useCallback(async (raw: string) => {
    const c = raw.trim().toUpperCase();
    const d = remote ? (await checkDiscount(c)) ?? undefined : get<Discount[]>('discounts', []).find((x) => x.active && x.code === c);
    if (!d) return 'Code not recognised.';
    const sub = get<CartLine[]>('cart', []).reduce((a, l) => a + l.unit * l.qty, 0);
    if (sub < (d.min || 0)) return 'Spend Rs ' + d.min.toLocaleString('en-LK') + ' or more to use this code.';
    setRemoteDisc(d); setDiscCode(d.code);
    return '';
  }, []);

  const reorder = useCallback((o: Order) => {
    let n = 0;
    o.items.forEach((i) => {
      if (i.pid && i.sel && addCandle(i.pid, { opts: i.sel.opts, color: i.sel.color, blend: i.sel.blend, sticker: i.sel.sticker, qty: i.qty })) n += 1;
    });
    return n;
  }, [addCandle]);

  const toggleWish = useCallback((id: number) => {
    const w = get<number[]>('wish', []);
    set('wish', w.includes(id) ? w.filter((x) => x !== id) : w.concat(id));
  }, []);

  const signIn = useCallback((u: User | Session) => set<Session>('session', { id: u.id, name: u.name, email: u.email }), []);
  const signOut = useCallback(() => { if (remote) void customerSignOut(); set('session', null); flash('Signed out'); go(''); }, [flash]);
  const acceptCookie = useCallback(() => set('cookie', true), []);

  const value: Ctx = {
    products, active, colors, categories, seasons, liveSeasons, seasonal, shelf, settings, reviews, cart, wish, user, disc, setDisc, applyCode, discObj, totals, toast, flash, cartOpen, setCartOpen,
    qv, setQv, addCandle, addLine, reorder, setQty, clearCart, toggleWish, signIn, signOut, cookieAccepted, acceptCookie,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
