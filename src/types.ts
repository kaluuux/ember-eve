export interface Scent { n: string; f: string; tint: string; note: string }
export interface Wax { l: string; add: number }
export interface Size { l: string; p: number; burn: string; stock: number }

export interface Product {
  id: number;
  name: string;
  shape: string;
  blurb: string;
  desc: string;
  sizes: Size[];
  scents: string[];
  active: boolean;
  featured: boolean;
}

export interface Discount {
  code: string;
  type: 'pct' | 'fixed' | 'ship';
  value: number;
  min: number;
  active: boolean;
  note?: string;
}

export interface Settings {
  shop: string;
  email: string;
  standard: number;
  express: number;
  freeOver: number;
  giftWrap: number;
}

export interface Address { first?: string; last?: string; phone?: string; a1?: string; a2?: string; city?: string; post?: string }

export interface User { id: number; name: string; email: string; password: string; address: Address; joined: string }
export interface Session { id: number; name: string; email: string }

export interface CartLine {
  key: string;
  /** 0 for gift sets */
  pid: number;
  si: number;
  wi?: number;
  scent?: string;
  name: string;
  sub: string;
  unit: number;
  tint: string;
  qty: number;
}

export interface OrderItem { name: string; sub: string; qty: number; unit: number; tint: string; pid: number; si: number }
export type OrderStatus = 'Processing' | 'Dispatched' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  date: string;
  email: string;
  name: string;
  first?: string;
  phone: string;
  address: { a1: string; a2: string; city: string; post: string };
  items: OrderItem[];
  sub: number;
  disc: number;
  code: string;
  ship: number;
  shipM: 'standard' | 'express';
  wrap: number;
  total: number;
  status: OrderStatus;
  pay: string;
  note: string;
  userId: number | null;
  log: { s: string; d: string }[];
}

export interface Review { id: number; pid: number; who: string; stars: number; q: string; date: string; approved: boolean }
export interface Message { id: number; name: string; email: string; text: string; date: string; read: boolean }
export interface Subscriber { email: string; date: string }
