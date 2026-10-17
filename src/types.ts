export interface Color { id: string; name: string; hex: string }
export interface Category { id: string; name: string; blurb: string }
/** A choice inside an option group. `colors` restricts the colours offered when this choice is picked (e.g. brown jar: white only). */
export interface Opt { id: string; label: string; add: number; colors?: string[] }
export interface Group { id: string; label: string; options: Opt[] }
export type Pin = 'best' | 'trending' | 'new';
/** A seasonal collection that is shown on the storefront only inside its date window (MM-DD, may wrap the year end). */
export interface Season { id: string; name: string; from: string; to: string; force: '' | 'on' | 'off'; blurb: string }

export interface Product {
  id: number;
  name: string;
  /** Category id */
  cat: string;
  blurb: string;
  desc: string;
  base: number;
  groups: Group[];
  /** Offers the colour palette */
  colors: boolean;
  /** Offers a custom blend of 2+ palette colours */
  custom: boolean;
  /** Offers a free custom message or quote on the sticker (jar and glass candles) */
  sticker?: boolean;
  /** null = made to order (no stock limit) */
  stock: number | null;
  /** Percentage off, 0 = not on sale */
  salePct: number;
  /** Admin-pinned shelf badges, on top of the automatic ones */
  pins: Pin[];
  /** Season id, '' = year-round */
  season: string;
  active: boolean;
  featured: boolean;
  created: string;
}

export interface Discount {
  code: string;
  type: 'pct' | 'fixed' | 'ship';
  value: number;
  min: number;
  active: boolean;
  note?: string;
}

export type PayMethod = 'card' | 'bank' | 'whatsapp' | 'store';
export interface GiftBox { id: string; label: string; slots: number; fee: number }
export interface District { name: string; rate: number }
/** A bank account customers can pay into, with an optional LankaQR image (a URL, or a data URL in the offline demo) */
export interface BankAccount { id: string; bank: string; branch: string; name: string; number: string; qr: string }

export interface Settings {
  shop: string;
  email: string;
  standard: number;
  express: number;
  freeOver: number;
  giftWrap: number;
  /** Colours in a custom blend that are free; each extra costs `extraColorFee` */
  freeColors: number;
  extraColorFee: number;
  giftBoxFee: number;
  /** Optional fixed box sizes. Empty = any 2 to 8 candles at `giftBoxFee`. */
  giftBoxes: GiftBox[];
  /** Per-district standard delivery rate; districts not listed use `standard` */
  districts: District[];
  pickupAddress: string;
  /** Number in international format without +, e.g. 94771234567 */
  whatsapp: string;
  banks: BankAccount[];
  /** Old single-account field, converted into `banks` when settings are read */
  bank?: { bank: string; name: string; number: string; branch: string };
  pay: Record<PayMethod, boolean>;
  payhereMerchantId: string;
  payhereSandbox: boolean;
}

export interface Address { district?: string; first?: string; last?: string; phone?: string; a1?: string; a2?: string; city?: string; post?: string }

export interface User { id: number; name: string; email: string; password: string; address: Address; joined: string }
export interface Session { id: number | string; name: string; email: string }

export interface CartLine {
  key: string;
  /** 0 for gift boxes */
  pid: number;
  /** The customer's choices, sent to the server, which prices them itself */
  sel?: ItemSel;
  /** Gift box contents */
  box?: { pid: number; sel: ItemSel }[];
  boxId?: string;
  name: string;
  sub: string;
  unit: number;
  tint: string;
  qty: number;
  /** Personal note for a gift box */
  note?: string;
}

export interface ItemSel { opts: Record<string, string>; color: string; blend: string[]; sticker?: string }
export interface OrderItem { name: string; sub: string; qty: number; unit: number; tint: string; pid: number; note?: string; box?: { pid: number; name: string }[] }
export type OrderStatus = 'Processing' | 'Dispatched' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  date: string;
  email: string;
  name: string;
  first?: string;
  phone: string;
  address: { a1: string; a2: string; city: string; district?: string; post: string };
  items: OrderItem[];
  sub: number;
  disc: number;
  code: string;
  ship: number;
  shipM: 'standard' | 'express' | 'pickup';
  wrap: number;
  total: number;
  status: OrderStatus;
  pay: string;
  payMethod?: PayMethod;
  payStatus?: 'Pending' | 'Receipt sent' | 'Paid' | 'Failed';
  /** Storage paths of uploaded bank-transfer receipts */
  receipts?: string[];
  tracking?: { courier: string; number: string; url: string };
  note: string;
  /** Note from the buyer to the seller */
  sellerNote?: string;
  userId: number | string | null;
  log: { s: string; d: string }[];
}

export interface Review { id: number; pid: number; who: string; stars: number; q: string; date: string; approved: boolean }
export interface Message { id: number; name: string; email: string; text: string; date: string; read: boolean }
export interface Subscriber { email: string; date: string }
