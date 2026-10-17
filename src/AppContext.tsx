import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CartLine, Discount, Product, Review, Session, Settings, User } from './types';
import { DEFAULT_SETTINGS, EMPTY, WAX, get, scentOf, set, useStored } from './store';
import { computeTotals, type Totals } from './commerce';
import { go } from './router';

export interface QuickView { id: number; scent: string; si: number; wi: number; qty: number }

interface Ctx {
  products: Product[];
  active: Product[];
  settings: Settings;
  reviews: Review[];
  cart: CartLine[];
  wish: number[];
  user: Session | null;
  disc: string;
  setDisc: (code: string) => void;
  discObj: Discount | undefined;
  totals: Totals;
  toast: string;
  flash: (m: string) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  qv: QuickView | null;
  setQv: (q: QuickView | null | ((q: QuickView | null) => QuickView | null)) => void;
  addCandle: (pid: number, scent: string, si: number, wi: number, qty: number) => boolean;
  addLine: (line: CartLine) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const products = useStored<Product[]>('products', EMPTY);
  const settings = useStored<Settings>('settings', DEFAULT_SETTINGS);
  const reviewsAll = useStored<Review[]>('reviews', EMPTY);
  const discounts = useStored<Discount[]>('discounts', EMPTY);
  const cart = useStored<CartLine[]>('cart', EMPTY);
  const wish = useStored<number[]>('wish', EMPTY);
  const user = useStored<Session | null>('session', NO_SESSION);
  const cookieAccepted = useStored<boolean>('cookie', false);

  const [disc, setDisc] = useState('');
  const [toast, setToast] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [qv, setQv] = useState<QuickView | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 2000);
  }, []);

  const active = useMemo(() => products.filter((p) => p.active), [products]);
  const reviews = useMemo(() => reviewsAll.filter((r) => r.approved), [reviewsAll]);
  const discObj = useMemo(() => discounts.find((d) => d.active && d.code === disc), [discounts, disc]);
  const totals = useMemo(() => computeTotals(cart, discObj, settings), [cart, discObj, settings]);

  const addLine = useCallback((line: CartLine) => {
    const c = get<CartLine[]>('cart', []).slice();
    const i = c.findIndex((x) => x.key === line.key);
    if (i >= 0) c[i] = { ...c[i], qty: Math.min(10, c[i].qty + line.qty) };
    else c.push(line);
    set('cart', c);
  }, []);

  const addCandle: Ctx['addCandle'] = useCallback((pid, scent, si, wi, qty) => {
    const p = get<Product[]>('products', []).find((x) => x.id === pid);
    const z = p?.sizes[si];
    if (!p || !z) return false;
    if (z.stock <= 0) { flash('Sold out'); return false; }
    const w = WAX[wi];
    const key = [pid, scent, si, wi].join('-');
    const cur = get<CartLine[]>('cart', []).slice();
    const i = cur.findIndex((x) => x.key === key);
    const have = cur.filter((x) => x.pid === pid && x.si === si).reduce((a, x) => a + x.qty, 0);
    const n = Math.min(qty, z.stock - have);
    if (n <= 0) { flash('Only ' + z.stock + ' in stock'); return false; }
    if (i >= 0) cur[i] = { ...cur[i], qty: cur[i].qty + n };
    else cur.push({ key, pid, si, wi, scent, name: p.name + ', ' + scent, sub: z.l + ' · ' + w.l, unit: z.p + w.add, tint: scentOf(scent).tint, qty: n });
    set('cart', cur);
    flash(n < qty ? 'Added ' + n + ' (stock limit)' : 'Added to basket');
    return true;
  }, [flash]);

  const setQty: Ctx['setQty'] = useCallback((key, d) => {
    const cur = get<CartLine[]>('cart', []).slice();
    const i = cur.findIndex((x) => x.key === key);
    if (i < 0) return;
    const l = cur[i];
    const prods = get<Product[]>('products', []);
    const others = cur.filter((x, j) => j !== i && x.pid === l.pid && x.si === l.si).reduce((a, x) => a + x.qty, 0);
    const stock = l.pid ? prods.find((p) => p.id === l.pid)?.sizes[l.si]?.stock ?? 0 : 10;
    const max = l.pid ? stock - others : 10;
    let q = l.qty + d;
    if (q > max) { flash('Only ' + max + ' in stock'); q = max; }
    if (q <= 0) cur.splice(i, 1); else cur[i] = { ...l, qty: q };
    set('cart', cur);
  }, [flash]);

  const clearCart = useCallback(() => { set('cart', []); setDisc(''); }, []);

  const toggleWish = useCallback((id: number) => {
    const w = get<number[]>('wish', []);
    set('wish', w.includes(id) ? w.filter((x) => x !== id) : w.concat(id));
  }, []);

  const signIn = useCallback((u: User | Session) => set<Session>('session', { id: u.id, name: u.name, email: u.email }), []);
  const signOut = useCallback(() => { set('session', null); flash('Signed out'); go(''); }, [flash]);
  const acceptCookie = useCallback(() => set('cookie', true), []);

  const value: Ctx = {
    products, active, settings, reviews, cart, wish, user, disc, setDisc, discObj, totals, toast, flash, cartOpen, setCartOpen,
    qv, setQv, addCandle, addLine, setQty, clearCart, toggleWish, signIn, signOut, cookieAccepted, acceptCookie,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
