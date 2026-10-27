import { useSyncExternalStore } from 'react';
import { tr } from './i18n';
import { sb, remote } from './remote';
import { clearLocal, get, registerPush, setLocal, starterCatalog } from './store';
import { go } from './router';
import type { Address, Discount, Message, Order, Product, Review, SavedAddress, Session } from './types';

export type Role = 'owner' | 'staff' | '';

/**
 * Server sync (Supabase). Public data is loaded for everyone; admin edits are written through.
 * When Supabase is not configured every function here is a no-op and the app runs on localStorage.
 */

export type Sales = Record<number, { all: number; recent: number }>;
const CATALOG_KEYS = ['products', 'colors', 'categories', 'seasons', 'settings'] as const;

/* ------------------------------------------------------------------ admin session */
let admin = false;
const ADM = 'ee-admin-state';
const subAdmin = (cb: () => void) => { window.addEventListener(ADM, cb); return () => window.removeEventListener(ADM, cb); };
export const useIsAdmin = () => useSyncExternalStore(subAdmin, () => admin);
/** owner sees everything; staff can pack and dispatch but never sees money, customers or settings */
let role: Role = '';
export const useRole = () => useSyncExternalStore(subAdmin, () => role);

export async function refreshAdmin(): Promise<void> {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  let ok = false, r: Role = '';
  if (data.session) ok = (await sb.rpc('is_admin')).data === true;
  if (ok) r = (await sb.rpc('my_role')).data === 'staff' ? 'staff' : 'owner';
  const changed = ok !== admin || r !== role;
  admin = ok; role = r;
  if (changed) window.dispatchEvent(new Event(ADM));
  if (ok) await hydrate();
}

export async function adminSignIn(email: string, password: string): Promise<string> {
  if (!sb) return 'Server is not configured.';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return 'Email or password is incorrect.';
  await refreshAdmin();
  return admin ? '' : 'This account is not an admin.';
}
export async function adminSignOut() {
  await sb?.auth.signOut();
  admin = false; role = '';
  window.dispatchEvent(new Event(ADM));
}

/* ------------------------------------------------------------------------ errors */
function fail(msg: string) { window.dispatchEvent(new CustomEvent('ee-sync-error', { detail: msg })); }
export const onSyncError = (cb: (m: string) => void) => {
  const h = (e: Event) => cb((e as CustomEvent<string>).detail);
  window.addEventListener('ee-sync-error', h);
  return () => window.removeEventListener('ee-sync-error', h);
};

/* ---------------------------------------------------------------------- loading */
const last = { products: new Map<number, string>(), orders: new Map<string, string>(), reviews: new Map<number, string>(), messages: new Map<number, string>() };
let catalogEmpty = false;
export const isCatalogEmpty = () => catalogEmpty;

/** True once the first load from the server has finished (always true offline). Lets pages show a skeleton instead of "not found". */
let loaded = false;
const LOADED = 'ee-loaded';
const subLoaded = (cb: () => void) => { window.addEventListener(LOADED, cb); return () => window.removeEventListener(LOADED, cb); };
export const useHydrated = () => useSyncExternalStore(subLoaded, () => !remote || loaded);
function markLoaded() { if (!loaded) { loaded = true; window.dispatchEvent(new Event(LOADED)); } }

export async function hydrate(): Promise<void> {
  if (!sb) return;
  try {
    const kv = await sb.from('catalog_kv').select('key,value');
    if (!kv.error) {
      const rows = new Map((kv.data ?? []).map((r) => [r.key as string, r.value]));
      catalogEmpty = !rows.has('products');
      CATALOG_KEYS.forEach((k) => (rows.has(k) ? setLocal(k, rows.get(k)) : clearLocal(k)));
      last.products = new Map(((rows.get('products') ?? []) as Product[]).map((p) => [p.id, JSON.stringify(p)]));
      if (admin && rows.has('discounts')) setLocal('discounts', rows.get('discounts'));
    }
    const rv = await sb.from('reviews').select('id,data,approved').order('id');
    if (!rv.error) {
      const list = (rv.data ?? []).map((r) => ({ ...(r.data as object), id: r.id as number, approved: r.approved as boolean }) as Review);
      setLocal('reviews', list);
      last.reviews = new Map(list.map((r) => [r.id, JSON.stringify(r)]));
    }
    const sales = await sb.rpc('sales_summary');
    if (!sales.error) {
      const m: Sales = {};
      (sales.data ?? []).forEach((r: { pid: number; qty: number; last_30: number }) => { m[r.pid] = { all: r.qty, recent: r.last_30 }; });
      setLocal('sales', m);
    }
    if (admin && role === 'staff') {
      const sd = await sb.rpc('staff_orders');
      if (!sd.error) {
        const list = ((sd.data as Partial<Order>[] | null) ?? []).map((o) => ({ sub: 0, disc: 0, code: '', ship: 0, wrap: 0, total: 0, email: '', userId: null, log: [], pay: '', payStatus: (o as { paid?: boolean }).paid ? 'Paid' : 'Pending', ...o }) as Order).reverse();
        setLocal('orders', list);
        last.orders = new Map(list.map((o) => [o.id, JSON.stringify(o)]));
      }
    } else if (admin) {
      const od = await sb.from('orders').select('id,data,status').order('created_at');
      if (!od.error) {
        const list = (od.data ?? []).map((r) => ({ ...(r.data as Order), id: r.id as string, status: r.status as Order['status'] }));
        setLocal('orders', list);
        last.orders = new Map(list.map((o) => [o.id, JSON.stringify(o)]));
      }
      const pr = await sb.from('profiles').select('id,email,name,phone,address,addresses,created_at').order('created_at');
      if (!pr.error) {
        setLocal('users', (pr.data ?? []).map((r) => ({ id: r.id, name: r.name ?? '', email: r.email ?? '', password: '', phone: r.phone ?? '', address: r.address ?? {}, addresses: r.addresses ?? [], joined: String(r.created_at).slice(0, 10) })));
      }
      const pc = await sb.from('product_costs').select('pid,cost');
      if (!pc.error) setLocal('costs', Object.fromEntries((pc.data ?? []).map((r) => [String(r.pid), Number(r.cost)])));
      const sbs = await sb.from('subscribers').select('email,created_at').order('created_at');
      if (!sbs.error) setLocal('subscribers', (sbs.data ?? []).map((r) => ({ email: r.email as string, date: r.created_at as string })));
      const ms = await sb.from('messages').select('id,data,is_read').order('id');
      if (!ms.error) {
        const list = (ms.data ?? []).map((r) => ({ ...(r.data as object), id: r.id as number, read: r.is_read as boolean }) as Message);
        setLocal('messages', list);
        last.messages = new Map(list.map((m) => [m.id, JSON.stringify(m)]));
      }
    }
  } catch {
    /* offline: keep the cached copy */
  } finally {
    markLoaded();
  }
}

/* ---------------------------------------------------------------- admin write-through */
let queue: Promise<void> = Promise.resolve();

async function upsertKv(key: string, value: unknown) {
  const { error } = await sb!.from('catalog_kv').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Merge only the products this admin changed into the server copy, so customer-driven stock changes are not overwritten. */
async function pushProducts(local: Product[]) {
  const cur = await sb!.from('catalog_kv').select('value').eq('key', 'products').maybeSingle();
  let remoteArr: Product[] = (cur.data?.value as Product[] | undefined) ?? [];
  const localIds = new Set(local.map((p) => p.id));
  remoteArr = remoteArr.filter((p) => !(last.products.has(p.id) && !localIds.has(p.id)));
  for (const p of local) {
    const was = last.products.get(p.id);
    if (was === JSON.stringify(p)) continue;
    const idx = remoteArr.findIndex((r) => r.id === p.id);
    const old = was ? (JSON.parse(was) as Product) : null;
    const next = idx >= 0 && old && old.stock === p.stock ? { ...p, stock: remoteArr[idx].stock } : p;
    if (idx >= 0) remoteArr[idx] = next; else remoteArr.push(next);
  }
  await upsertKv('products', remoteArr);
  last.products = new Map(remoteArr.map((p) => [p.id, JSON.stringify(p)]));
  setLocal('products', remoteArr);
}

async function pushRows<T, K extends string | number>(table: string, list: T[], id: (t: T) => K, row: (t: T) => Record<string, unknown>, map: Map<K, string>, insertNew: boolean) {
  const ids = new Set(list.map(id));
  for (const k of [...map.keys()]) {
    if (ids.has(k)) continue;
    const { error } = await sb!.from(table).delete().eq('id', k);
    if (error) throw error;
    map.delete(k);
  }
  for (const t of list) {
    const k = id(t), json = JSON.stringify(t);
    if (map.get(k) === json) continue;
    if (!map.has(k) && !insertNew) continue;
    const { error } = await sb!.from(table).upsert({ id: k, ...row(t) });
    if (error) throw error;
    map.set(k, json);
  }
}

/** Send only the fields the admin changed for each order, so a receipt uploaded at the same moment is never overwritten. */
async function pushOrders(list: Order[]) {
  for (const o of list) {
    const json = JSON.stringify(o), was = last.orders.get(o.id);
    if (was === json || was === undefined) continue;
    const before = JSON.parse(was) as Record<string, unknown>, after = o as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    const staffKeys = ['status', 'tracking', 'packed'];
    for (const key of Object.keys(after)) {
      if (key === 'receipts' || (role === 'staff' && !staffKeys.includes(key))) continue;
      if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) patch[key] = after[key];
    }
    if (Object.keys(patch).length) {
      const { error } = role === 'staff' ? await sb!.rpc('staff_update_order', { oid: o.id, patch }) : await sb!.rpc('admin_patch_order', { oid: o.id, patch });
      if (error) throw error;
    }
    last.orders.set(o.id, json);
  }
}

function pushKey(k: string, v: unknown) {
  if (!sb || !admin) return;
  queue = queue.then(async () => {
    try {
      if (k === 'products') await pushProducts(v as Product[]);
      else if ((CATALOG_KEYS as readonly string[]).includes(k) || k === 'discounts') await upsertKv(k, v);
      else if (k === 'orders') await pushOrders(v as Order[]);
      else if (k === 'reviews') {
        const list = v as Review[];
        // Delete server rows that were removed locally
        const ids = new Set(list.map((r) => r.id));
        for (const k of [...last.reviews.keys()]) {
          if (ids.has(k)) continue;
          const { error } = await sb!.from('reviews').delete().eq('id', k);
          if (error) throw error;
          last.reviews.delete(k);
        }
        for (const r of list) {
          const json = JSON.stringify(r);
          if (last.reviews.get(r.id) === json) continue;
          if (!last.reviews.has(r.id)) {
            // New review only exists locally — insert without id (Postgres uses generated always as identity)
            const { data: inserted, error } = await sb!.from('reviews').insert({ data: (({ id: _id, approved: _ap, ...d }) => d)(r), approved: r.approved }).select('id').single();
            if (error) throw error;
            // Update local list to use the real server-assigned id
            const serverList = get<Review[]>('reviews', []).map((x) => x.id === r.id ? { ...x, id: (inserted as { id: number }).id } : x);
            setLocal('reviews', serverList);
            last.reviews.set((inserted as { id: number }).id, JSON.stringify({ ...r, id: (inserted as { id: number }).id }));
          } else {
            // Existing server row — UPDATE only, never supply id in the payload
            const { id, approved, ...data } = r;
            const { error } = await sb!.from('reviews').update({ data, approved }).eq('id', id);
            if (error) throw error;
            last.reviews.set(r.id, json);
          }
        }
      }
      else if (k === 'messages') await pushRows('messages', v as Message[], (m) => m.id, (m) => { const { id, read, ...data } = m; void id; return { data, is_read: read }; }, last.messages, false);
    } catch (e) {
      fail('Could not save to the server: ' + ((e as { message?: string }).message ?? 'unknown error') + '. Refresh and try again.');
      void hydrate();
    }
  });
}
registerPush(pushKey);

/** Admin: upload the starter catalogue to an empty server. */
export async function publishStarter(): Promise<string> {
  if (!sb || !admin) return 'Sign in as admin first.';
  try {
    const c = starterCatalog();
    for (const k of [...CATALOG_KEYS, 'discounts'] as const) await upsertKv(k, c[k]);
    await hydrate();
    return '';
  } catch (e) {
    return (e as { message?: string }).message ?? 'Failed';
  }
}

/* --------------------------------------------------------------- customer actions */
/** Turn a database error from the order functions into something a customer can read. */
export function orderErrorText(e: unknown): string {
  const m = (e as { message?: string })?.message ?? '';
  const name = m.split(':').slice(1).join(':').trim();
  if (m.includes('out_of_stock')) return tr('{name} is no longer available in that quantity. Please update your basket.', { name: name || tr('An item') });
  if (m.includes('unavailable')) return 'An item in your basket is no longer available. Please remove it and try again.';
  if (m.includes('bad_color') || m.includes('bad_option') || m.includes('bad_blend')) return 'A candle in your basket has options that are no longer offered. Please re-add it.';
  if (m.includes('invalid:email')) return 'Enter a valid email address.';
  if (m.includes('invalid:contact')) return 'Enter your name and a phone number.';
  if (m.includes('invalid:address')) return 'Enter your delivery address.';
  if (m.includes('invalid:payment')) return 'That payment method is not available.';
  if (m.includes('invalid:box')) return 'The gift box is not valid. Please rebuild it.';
  if (m.includes('invalid:giftcode')) return 'That gift card code is not valid, or it has no balance left.';
  if (m.includes('invalid:giftcard_use')) return 'A gift card cannot be paid for with another gift card or store credit.';
  if (m.includes('invalid:giftcard')) return 'Gift cards are not on sale right now, or that amount is not allowed. Please remove it from your basket.';
  if (m.includes('giftcard_changed')) return 'That gift card was just used. Please check the code and try again.';
  if (m.includes('rate_limited')) return 'Too many attempts. Please wait a little and try again.';
  return 'We could not process your order. Please check your connection and try again.';
}

/** What the server will charge for this order. Nothing is stored. */
export async function quoteOrder(order: unknown): Promise<Order> {
  const { data, error } = await sb!.rpc('quote_order', { o: order });
  if (error) throw error;
  return data as Order;
}

/** Place the order; the server prices it from the live catalogue and returns the final order. */
export async function placeOrder(order: unknown): Promise<Order> {
  const { data, error } = await sb!.rpc('place_order', { o: order });
  if (error) throw error;
  void hydrate();
  return data as Order;
}

/** Upload a bank-transfer receipt (photo or PDF) and record it against the order. Returns an error message or ''. */
export async function uploadReceipt(orderId: string, email: string, file: File): Promise<string> {
  if (!sb) return 'Uploads need the online store.';
  if (file.size > 5 * 1024 * 1024) return 'That file is over 5 MB. Please send a smaller photo.';
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = orderId + '/' + Date.now() + '.' + ext;
  const up = await sb.storage.from('receipts').upload(path, file, { contentType: file.type || undefined });
  if (up.error) return 'Could not upload the file. Check that it is a photo or PDF under 5 MB.';
  const { data, error } = await sb.rpc('attach_receipt', { oid: orderId, mail: email, path });
  if (error || data !== true) return 'The file was uploaded but could not be linked to your order. Please send it on WhatsApp.';
  return '';
}

/** Admin: temporary links to view receipts. */
export async function receiptLinks(paths: string[]): Promise<{ path: string; url: string }[]> {
  if (!sb || !paths.length) return [];
  const { data } = await sb.storage.from('receipts').createSignedUrls(paths, 3600);
  return (data ?? []).filter((d) => d.signedUrl).map((d) => ({ path: d.path ?? '', url: d.signedUrl as string }));
}

export interface TrackResult {
  id: string; date: string; status: Order['status']; payStatus: NonNullable<Order['payStatus']>; payMethod?: string; shipM: Order['shipM'];
  tracking?: Order['tracking'] | null; log: { s: string; d: string }[]; city?: string; district?: string; first?: string;
  items: { name: string; qty: number; tint: string }[];
}
/** Anyone can look up an order with the mobile number it was placed with plus the order number or courier tracking number. */
export async function trackOrder(q: string, phone: string): Promise<{ result: TrackResult | null; error: string }> {
  if (!sb) return { result: null, error: '' };
  const { data, error } = await sb.rpc('track_order', { q, phone });
  if (error) return { result: null, error: /rate_limited/.test(error.message) ? 'Too many attempts. Please wait a few minutes and try again.' : 'Could not look that up. Please try again.' };
  return { result: (data as TrackResult | null) ?? null, error: '' };
}

export async function myOrders(): Promise<Order[]> {
  if (!sb) return [];
  const { data } = await sb.rpc('my_orders');
  return (data as Order[] | null) ?? [];
}

export async function fetchOrder(id: string, email: string): Promise<Order | null> {
  if (!sb) return null;
  const { data } = await sb.rpc('get_order', { oid: id.trim().toUpperCase(), mail: email.trim() });
  return (data as Order | null) ?? null;
}

/** Photos in the review bucket are stored by path; offline they are data URLs. */
export const reviewPhotoUrl = (p: string): string => (!sb || /^(https?:|data:)/.test(p) ? p : sb.storage.from('review-photos').getPublicUrl(p).data.publicUrl);

/** Upload one review photo into the order's folder. Returns the storage path (or a data URL offline). */
export async function uploadReviewPhoto(orderId: string, file: File): Promise<{ path: string; error: string }> {
  try {
    const blob = await shrinkImage(file, 1200, 'image/jpeg');
    if (!sb) return { path: await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); }), error: '' };
    const path = orderId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
    const up = await sb.storage.from('review-photos').upload(path, blob, { contentType: 'image/jpeg' });
    return up.error ? { path: '', error: 'Could not upload that photo. Try a smaller one.' } : { path, error: '' };
  } catch {
    return { path: '', error: 'That file is not a readable image.' };
  }
}

/** A review from someone who received the product. The server checks the order; the shop approves it before it shows. */
export async function submitReview(a: { orderId: string; email: string; pid: number; stars: number; q: string; photos: string[]; who: string }): Promise<string> {
  if (!sb) {
    const list = JSON.parse(localStorage.getItem('ee_reviews') || '[]') as Review[];
    setLocal('reviews', list.concat({ id: Date.now(), pid: a.pid, who: a.who, stars: a.stars, q: a.q, date: new Date().toISOString().slice(0, 10), approved: false, verified: true, orderId: a.orderId, photos: a.photos }));
    return '';
  }
  const { error } = await sb.rpc('submit_review', { oid: a.orderId, mail: a.email, pid_in: a.pid, stars: a.stars, q: a.q, photos: a.photos });
  if (!error) return '';
  if (/already_reviewed/.test(error.message)) return 'You have already reviewed this candle. Thank you!';
  if (/not_eligible/.test(error.message)) return 'Reviews open once your order is delivered.';
  if (/invalid_review/.test(error.message)) return 'Add a star rating and a few words.';
  return 'Could not send your review. Please try again.';
}

/** Ask the shop to cancel an order that has not been dispatched yet. */
export async function requestCancel(orderId: string, email: string, reason: string): Promise<string> {
  if (!sb) {
    const list = JSON.parse(localStorage.getItem('ee_orders') || '[]') as Order[];
    setLocal('orders', list.map((o) => (o.id === orderId ? { ...o, cancelRequest: { state: 'pending' as const, at: new Date().toISOString(), reason } } : o)));
    return '';
  }
  const { data, error } = await sb.rpc('request_cancel', { oid: orderId, mail: email, reason });
  return error || data !== true ? 'This order can no longer be cancelled online. Please message us.' : '';
}

/** Back-in-stock alert for a sold-out candle. */
export async function requestStockAlert(pid: number, contact: string): Promise<string> {
  if (!sb) {
    const list = JSON.parse(localStorage.getItem('ee_alerts') || '[]') as unknown[];
    setLocal('alerts', list.concat({ id: Date.now(), pid, contact, kind: contact.includes('@') ? 'email' : 'phone', notified: false, created_at: new Date().toISOString() }));
    return '';
  }
  const { error } = await sb.rpc('request_stock_alert', { pid_in: pid, contact_in: contact });
  if (!error) return '';
  if (/invalid:contact/.test(error.message)) return 'Enter an email address or a mobile number.';
  if (/rate_limited/.test(error.message)) return 'Too many requests. Please try again later.';
  return 'Could not save that. Please try again.';
}

/** The code's remaining balance, or null when it is not valid. */
export async function checkGiftCard(code: string): Promise<{ balance: number } | null | 'busy'> {
  if (!sb) return null;
  const { data, error } = await sb.rpc('check_gift_card', { c: code });
  if (error) return /rate_limited/.test(error.message) ? 'busy' : null;
  return (data as { balance: number } | null) ?? null;
}

/* ------------------------------------------------------------ rewards (signed-in customer) */
export interface Wallet { credit: number; refCode: string; ledger: { id: number; delta: number; reason: string; at: string; order_id: string | null }[] }
export async function loadWallet(): Promise<Wallet | null> {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return null;
  const pr = await sb.from('profiles').select('credit,ref_code').eq('id', id).maybeSingle();
  const lg = await sb.from('credit_ledger').select('id,delta,reason,at,order_id').eq('user_id', id).order('id', { ascending: false }).limit(30);
  if (pr.error) return null;
  return { credit: Number(pr.data?.credit ?? 0), refCode: (pr.data?.ref_code as string | null) ?? '', ledger: (lg.data ?? []) as Wallet['ledger'] };
}

/* ----------------------------------------------------------------- admin: owner tools */
export interface ActivityRow { id: number; at: string; actor: string; action: string; target: string | null; detail: Record<string, unknown> }
export async function listActivity(): Promise<ActivityRow[]> {
  if (!sb) return [];
  const { data } = await sb.from('activity_log').select('id,at,actor,action,target,detail').order('id', { ascending: false }).limit(300);
  return (data ?? []) as ActivityRow[];
}

/** Private cost price of one candle. Never part of the public catalogue. */
export async function saveCost(pid: number, cost: number | null): Promise<string> {
  const m = { ...(JSON.parse(localStorage.getItem('ee_costs') || '{}') as Record<string, number>) };
  const clear = cost === null || !(cost >= 0);
  if (clear) delete m[String(pid)]; else m[String(pid)] = cost;
  setLocal('costs', m);
  if (!sb) return '';
  const { error } = clear ? await sb.from('product_costs').delete().eq('pid', pid) : await sb.from('product_costs').upsert({ pid, cost });
  return error ? 'Could not save the cost price. Run the latest schema.sql in Supabase.' : '';
}

export interface GiftCardRow { code: string; amount: number; balance: number; status: 'active' | 'disabled'; recipient: string | null; from_name: string | null; message: string | null; order_id: string | null; note: string | null; created_at: string }
export async function listGiftCards(): Promise<GiftCardRow[]> {
  if (!sb) return [];
  const { data } = await sb.from('gift_cards').select('*').order('created_at', { ascending: false }).limit(300);
  return (data ?? []) as GiftCardRow[];
}
export async function createGiftCard(amount: number, recipient: string, note: string): Promise<{ code: string; error: string }> {
  if (!sb) return { code: '', error: 'Gift cards need the online store.' };
  const { data, error } = await sb.rpc('admin_create_gift_card', { amount_in: amount, recipient_in: recipient || null, note_in: note || null });
  return error ? { code: '', error: 'Could not create the card.' } : { code: data as string, error: '' };
}
export async function setGiftCardStatus(code: string, status: 'active' | 'disabled'): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.from('gift_cards').update({ status }).eq('code', code);
  return error ? 'Could not update the card.' : '';
}
export async function adjustCredit(uid: string, delta: number, reason: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.rpc('admin_adjust_credit', { uid, delta, reason });
  return error ? 'Could not adjust the credit.' : '';
}
export async function customerCredits(): Promise<Record<string, { credit: number; refCode: string }>> {
  if (!sb) return {};
  const { data } = await sb.from('profiles').select('id,credit,ref_code');
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, { credit: Number(r.credit ?? 0), refCode: (r.ref_code as string | null) ?? '' }]));
}

export interface StockAlertRow { id: number; pid: number; contact: string; kind: 'email' | 'phone'; notified: boolean; created_at: string }
export async function listStockAlerts(): Promise<StockAlertRow[]> {
  if (!sb) return JSON.parse(localStorage.getItem('ee_alerts') || '[]') as StockAlertRow[];
  const { data } = await sb.from('stock_alerts').select('id,pid,contact,kind,notified,created_at').order('id', { ascending: false }).limit(500);
  return (data ?? []) as StockAlertRow[];
}
export async function markAlerts(ids: number[], notified: boolean): Promise<void> {
  if (!ids.length) return;
  if (!sb) {
    const list = JSON.parse(localStorage.getItem('ee_alerts') || '[]') as StockAlertRow[];
    setLocal('alerts', list.map((a) => (ids.includes(a.id) ? { ...a, notified } : a)));
    return;
  }
  await sb.from('stock_alerts').update({ notified }).in('id', ids);
}

/** Add an email to the newsletter list. A repeat sign-up counts as success. */
export async function subscribe(email: string): Promise<string> {
  const { error } = await sb!.from('subscribers').insert({ email: email.trim().toLowerCase() });
  if (!error || error.code === '23505') return '';
  return /rate_limited/.test(error.message) ? 'Too many sign-ups from here. Please try again later.' : 'Could not sign you up right now. Please try again.';
}

export async function sendMessage(m: Omit<Message, 'id' | 'read'>): Promise<void> {
  const { error } = await sb!.from('messages').insert({ data: m, is_read: false });
  if (error) throw error;
}

export async function checkDiscount(code: string): Promise<Discount | null> {
  const { data } = await sb!.rpc('check_discount', { c: code });
  return (data as Discount | null) ?? null;
}

/* ------------------------------------------------------------ customer accounts */
const authText = (m: string): string => {
  if (/invalid login/i.test(m)) return 'Email or password is incorrect.';
  if (/already registered|already been registered/i.test(m)) return 'An account with that email already exists. Try signing in.';
  if (/password/i.test(m) && /(short|least|weak)/i.test(m)) return 'Choose a stronger password (8+ characters).';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
  return m || 'Something went wrong. Please try again.';
};

/** Create an account. Returns an error, or '' and whether the person is already signed in (email confirmation off). */
export async function customerSignUp(name: string, email: string, password: string): Promise<{ error: string; signedIn: boolean }> {
  if (!sb) return { error: 'Accounts need the online store.', signedIn: false };
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin + '/' } });
  if (error) return { error: authText(error.message), signedIn: false };
  // Supabase hides "already registered" by returning a user with no identities
  if (data.user && data.user.identities?.length === 0) return { error: authText('already registered'), signedIn: false };
  return { error: '', signedIn: !!data.session };
}
export async function customerSignIn(email: string, password: string): Promise<string> {
  if (!sb) return 'Accounts need the online store.';
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? authText(error.message) : '';
}
/** Sign in (or sign up) with Google. Needs the Google provider switched on in Supabase. */
export async function signInWithGoogle(next = 'account'): Promise<string> {
  if (!sb) return 'Accounts need the online store.';
  try { localStorage.setItem('ee_next', next); } catch { /* ignore */ }
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } });
  return error ? 'Google sign-in is not available right now.' : '';
}
export async function customerSignOut() { await sb?.auth.signOut(); }
export async function requestReset(email: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' });
  return error ? authText(error.message) : '';
}
export async function updatePassword(password: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.auth.updateUser({ password });
  return error ? authText(error.message) : '';
}
export async function saveProfile(patch: { name?: string; phone?: string; address?: Address; addresses?: SavedAddress[] }): Promise<string> {
  if (!sb) return 'Not connected.';
  const { data } = await sb.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return 'Please sign in again.';
  const { error } = await sb.from('profiles').update(patch).eq('id', id);
  if (error) return 'Could not save. Please try again.';
  await loadAccount();
  return '';
}

/** Mirror the signed-in customer (if any) into the local cache the pages read from. */
async function loadAccount(): Promise<void> {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  if (!u) { clearLocal('session'); return; }
  const pr = await sb.from('profiles').select('name,phone,address,addresses,created_at').eq('id', u.id).maybeSingle();
  const name = (pr.data?.name as string | undefined) || (u.user_metadata?.name as string | undefined) || (u.email ?? '').split('@')[0];
  setLocal<Session>('session', { id: u.id, name, email: u.email ?? '' });
  void loadWallet().then((w) => setLocal('wallet', w));
  if (!admin) {
    setLocal('users', [{ id: u.id, name, email: u.email ?? '', password: '', phone: (pr.data?.phone as string | undefined) ?? '', address: (pr.data?.address as Address | undefined) ?? {}, addresses: (pr.data?.addresses as SavedAddress[] | undefined) ?? [], joined: String(pr.data?.created_at ?? '').slice(0, 10) }]);
    const mine = await sb.rpc('my_orders');
    if (!mine.error) {
      const list = (mine.data as Order[] | null) ?? [];
      const ids = new Set(list.map((o) => o.id));
      setLocal('orders', list.concat(((localStorage.getItem('ee_orders') ? JSON.parse(localStorage.getItem('ee_orders')!) : []) as Order[]).filter((o) => !ids.has(o.id))));
    }
  }
}

/* ------------------------------------------------------------- admin team and backup */
export async function adminEmail(): Promise<string> {
  if (!sb) return '';
  const { data } = await sb.auth.getSession();
  return data.session?.user.email ?? '';
}
export async function listAdmins(): Promise<{ email: string; role: 'owner' | 'staff' }[]> {
  if (!sb) return [];
  const { data } = await sb.from('admins').select('email,role').order('email');
  return (data ?? []).map((r) => ({ email: r.email as string, role: r.role === 'staff' ? 'staff' as const : 'owner' as const }));
}
export async function setAdminRole(email: string, r: 'owner' | 'staff'): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.from('admins').update({ role: r }).eq('email', email);
  return error ? (error.message.includes('last owner') ? 'There must always be one owner.' : 'Could not change the role.') : '';
}
export async function addAdmin(email: string, r: 'owner' | 'staff' = 'staff'): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.from('admins').insert({ email: email.trim().toLowerCase(), role: r });
  return error ? (error.code === '23505' ? 'That person is already an admin.' : 'Could not add admin: ' + error.message) : '';
}
export async function removeAdmin(email: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.from('admins').delete().eq('email', email);
  return error ? (/last (admin|owner)/.test(error.message) ? 'You cannot remove the last owner.' : 'Could not remove: ' + error.message) : '';
}

/* ------------------------------------------------------------------ shop images */
/** Shrink an image so it loads fast. Photos become JPEG; QR codes stay PNG so they stay sharp. */
async function shrinkImage(file: File, max: number, type: 'image/jpeg' | 'image/png'): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d')!;
  if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image'))), type, 0.86));
}

/**
 * Admin: upload an image. Online it goes to public storage and a URL comes back; offline it becomes a small data URL.
 * folder is "products", "categories", "gallery" or "qr".
 */
export async function uploadImage(file: File, folder: 'products' | 'categories' | 'gallery' | 'qr' = 'products'): Promise<{ url: string; error: string }> {
  try {
    const png = folder === 'qr';
    const blob = await shrinkImage(file, png ? 700 : sb ? 1600 : 900, png ? 'image/png' : 'image/jpeg');
    if (!sb) {
      const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
      return { url, error: '' };
    }
    const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + (png ? '.png' : '.jpg');
    const up = await sb.storage.from('shop-assets').upload(path, blob, { contentType: png ? 'image/png' : 'image/jpeg', cacheControl: '31536000' });
    if (up.error) return { url: '', error: 'Could not upload. Run the latest schema.sql in Supabase, then try again.' };
    return { url: sb.storage.from('shop-assets').getPublicUrl(path).data.publicUrl, error: '' };
  } catch {
    return { url: '', error: 'That file is not a readable image. Use a JPG, PNG or WebP photo.' };
  }
}
export const uploadQr = (file: File) => uploadImage(file, 'qr');

/* ----------------------------------------------------------------- phone alerts */
export async function getNotify(): Promise<{ topic: string; site: string } | null> {
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_get_notify');
  return error ? null : (data as { topic: string; site: string });
}
export async function setNotify(topic: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.rpc('admin_set_notify', { topic, site: window.location.origin });
  return error ? 'Could not save. Run the latest schema.sql in Supabase first.' : '';
}
export async function sendTestAlert(): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.rpc('admin_send_test');
  return error ? 'Could not send the test alert.' : '';
}

/** Admin: everything in the shop as one JSON-able object. */
export async function exportAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  if (!sb) return out;
  const all = async (t: string) => (await sb!.from(t).select('*')).data ?? [];
  out.catalog = await all('catalog_kv');
  out.orders = await all('orders');
  out.reviews = await all('reviews');
  out.messages = await all('messages');
  out.customers = await all('profiles');
  out.admins = await all('admins');
  return out;
}

/** Startup: load public data, restore any admin session, and keep the page fresh. */
export function startSync() {
  if (!remote) return;
  void hydrate().then(refreshAdmin).then(loadAccount);
  sb!.auth.onAuthStateChange((event) => {
    // sign-in / sign-out / password-reset link: refresh who we are, outside the auth callback
    window.setTimeout(() => { void refreshAdmin().then(loadAccount); }, 0);
    if (event === 'PASSWORD_RECOVERY') go('reset');
    if (event === 'SIGNED_IN') {
      let next = '';
      try { next = localStorage.getItem('ee_next') ?? ''; localStorage.removeItem('ee_next'); } catch { /* ignore */ }
      if (next) go(next);
    }
  });
  window.addEventListener('focus', () => { void hydrate(); });
  window.setInterval(() => { if (document.visibilityState === 'visible') void hydrate(); }, 60000);
}
