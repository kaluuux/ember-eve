import type { ReactNode } from 'react';
import type { Order, OrderStatus, Settings } from '../types';

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted" style={{ margin: '4px 0 0' }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------- badges */
export const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string; mark: string }> = {
  Processing: { bg: 'var(--a-warn-bg)', fg: 'var(--a-warn)', mark: '◔' },
  Dispatched: { bg: 'var(--a-info-bg)', fg: 'var(--a-info)', mark: '➜' },
  Delivered: { bg: 'var(--a-good-bg)', fg: 'var(--a-good)', mark: '✓' },
  Cancelled: { bg: 'var(--a-bad-bg)', fg: 'var(--a-bad)', mark: '✕' },
};
export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Processing;
  return <span className="tag" style={{ background: s.bg, color: s.fg }}><span aria-hidden="true">{s.mark}</span>{status}</span>;
}

/** Orders saved before payments existed have no payStatus; they count as paid. */
export const payOf = (o: Order): NonNullable<Order['payStatus']> => o.payStatus ?? 'Paid';
const PAY_STYLE = {
  Pending: { bg: '#EFEAE3', fg: 'var(--a-muted)', mark: '○', label: 'Awaiting payment' },
  'Receipt sent': { bg: 'var(--a-info-bg)', fg: 'var(--a-info)', mark: '◐', label: 'Receipt to check' },
  Paid: { bg: 'var(--a-good-bg)', fg: 'var(--a-good)', mark: '●', label: 'Paid' },
  Failed: { bg: 'var(--a-bad-bg)', fg: 'var(--a-bad)', mark: '✕', label: 'Payment rejected' },
} as const;
export function PayBadge({ o }: { o: Order }) {
  const s = PAY_STYLE[payOf(o)];
  return <span className="tag" style={{ background: s.bg, color: s.fg }}><span aria-hidden="true">{s.mark}</span>{s.label}</span>;
}

/* ------------------------------------------------------------------- icons */
const ICONS: Record<string, string> = {
  dash: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  orders: 'M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0',
  products: 'M12 3c1.5 2 2.5 3 2.5 4.5a2.5 2.5 0 0 1-5 0C9.5 6 10.5 5 12 3ZM8 12h8v8a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-8Z',
  catalog: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  customers: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 20a5 5 0 0 0-4-4.9',
  discounts: 'M20 12l-8 8-9-9V3h8l9 9ZM8 8h.01',
  reviews: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z',
  messages: 'M4 6h16v12H4V6Zm0 1 8 6 8-6',
  giftcards: 'M4 9h16v11H4V9Zm0 0V7h16v2M12 7v13M12 7c-1-3-5-3-5 0s5 0 5 0Zm0 0c1-3 5-3 5 0s-5 0-5 0Z',
  alerts: 'M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5L6 17Zm4 2a2 2 0 0 0 4 0',
  activity: 'M4 12h4l2.5-6 3 12 2.5-6H20',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7.4 7.4 0 0 0-2.2-1.3L14.5 3h-4l-.3 2.4a7.4 7.4 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9a7.4 7.4 0 0 0 2.2 1.3l.3 2.4h4l.3-2.4a7.4 7.4 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z',
};
export const Icon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] ?? ICONS.dash} /></svg>
);

/* ----------------------------------------------------------------- helpers */
export const compact = (n: number) => (n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(Math.round(n)));

/** Digits-only international form for wa.me links, assuming Sri Lanka (94) when the number starts with 0. */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('94')) return d;
  if (d.startsWith('0')) return '94' + d.slice(1);
  return d;
}
export const waLink = (phone: string, text: string) => 'https://wa.me/' + waNumber(phone) + '?text=' + encodeURIComponent(text);

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const text = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

export const shopName = (s: Settings) => s.shop || 'Ember & Eve';
