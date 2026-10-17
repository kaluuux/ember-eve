import { useSyncExternalStore } from 'react';
import { sb, remote } from './remote';
import { clearLocal, registerPush, setLocal, starterCatalog } from './store';
import { go } from './router';
import type { Address, Discount, Message, Order, Product, Review, Session } from './types';

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

export async function refreshAdmin(): Promise<void> {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  let ok = false;
  if (data.session) ok = (await sb.rpc('is_admin')).data === true;
  const changed = ok !== admin;
  admin = ok;
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
  admin = false;
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
    if (admin) {
      const od = await sb.from('orders').select('id,data,status').order('created_at');
      if (!od.error) {
        const list = (od.data ?? []).map((r) => ({ ...(r.data as Order), id: r.id as string, status: r.status as Order['status'] }));
        setLocal('orders', list);
        last.orders = new Map(list.map((o) => [o.id, JSON.stringify(o)]));
      }
      const pr = await sb.from('profiles').select('id,email,name,address,created_at').order('created_at');
      if (!pr.error) {
        setLocal('users', (pr.data ?? []).map((r) => ({ id: r.id, name: r.name ?? '', email: r.email ?? '', password: '', address: r.address ?? {}, joined: String(r.created_at).slice(0, 10) })));
      }
      const ms = await sb.from('messages').select('id,data,is_read').order('id');
      if (!ms.error) {
        const list = (ms.data ?? []).map((r) => ({ ...(r.data as object), id: r.id as number, read: r.is_read as boolean }) as Message);
        setLocal('messages', list);
        last.messages = new Map(list.map((m) => [m.id, JSON.stringify(m)]));
      }
    }
  } catch {
    /* offline: keep the cached copy */
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
    for (const key of Object.keys(after)) {
      if (key !== 'receipts' && JSON.stringify(after[key]) !== JSON.stringify(before[key])) patch[key] = after[key];
    }
    if (Object.keys(patch).length) {
      const { error } = await sb!.rpc('admin_patch_order', { oid: o.id, patch });
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
      else if (k === 'reviews') await pushRows('reviews', v as Review[], (r) => r.id, (r) => { const { id, approved, ...data } = r; void id; return { data, approved }; }, last.reviews, false);
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
  if (m.includes('out_of_stock')) return (name || 'An item') + ' is no longer available in that quantity. Please update your basket.';
  if (m.includes('unavailable')) return 'An item in your basket is no longer available. Please remove it and try again.';
  if (m.includes('bad_color') || m.includes('bad_option') || m.includes('bad_blend')) return 'A candle in your basket has options that are no longer offered. Please re-add it.';
  if (m.includes('invalid:email')) return 'Enter a valid email address.';
  if (m.includes('invalid:contact')) return 'Enter your name and a phone number.';
  if (m.includes('invalid:address')) return 'Enter your delivery address.';
  if (m.includes('invalid:payment')) return 'That payment method is not available.';
  if (m.includes('invalid:box')) return 'The gift box is not valid. Please rebuild it.';
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

export async function submitReview(r: Omit<Review, 'id' | 'approved'>): Promise<void> {
  const { error } = await sb!.from('reviews').insert({ data: r, approved: false });
  if (error) throw error;
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
export async function saveProfile(patch: { name?: string; address?: Address }): Promise<string> {
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
  const pr = await sb.from('profiles').select('name,address,created_at').eq('id', u.id).maybeSingle();
  const name = (pr.data?.name as string | undefined) || (u.user_metadata?.name as string | undefined) || (u.email ?? '').split('@')[0];
  setLocal<Session>('session', { id: u.id, name, email: u.email ?? '' });
  if (!admin) {
    setLocal('users', [{ id: u.id, name, email: u.email ?? '', password: '', address: (pr.data?.address as Address | undefined) ?? {}, joined: String(pr.data?.created_at ?? '').slice(0, 10) }]);
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
export async function listAdmins(): Promise<string[]> {
  if (!sb) return [];
  const { data } = await sb.from('admins').select('email').order('email');
  return (data ?? []).map((r) => r.email as string);
}
export async function addAdmin(email: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.from('admins').insert({ email: email.trim().toLowerCase() });
  return error ? (error.code === '23505' ? 'That person is already an admin.' : 'Could not add admin: ' + error.message) : '';
}
export async function removeAdmin(email: string): Promise<string> {
  if (!sb) return 'Not connected.';
  const { error } = await sb.from('admins').delete().eq('email', email);
  return error ? (error.message.includes('last admin') ? 'You cannot remove the last admin.' : 'Could not remove: ' + error.message) : '';
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
  });
  window.addEventListener('focus', () => { void hydrate(); });
  window.setInterval(() => { if (document.visibilityState === 'visible') void hydrate(); }, 60000);
}
