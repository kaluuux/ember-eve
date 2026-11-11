import { useCallback, useEffect, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { tr } from '../i18n';
import { MAX_QTY } from '../commerce';

export type FormValues = Record<string, string | number | undefined>;

/** Tiny controlled-form helper: `bind('email')` gives name/value/onChange for <Field>. */
export function useForm(initial: FormValues = {}) {
  const [f, setF] = useState<FormValues>(initial);
  const set = useCallback((patch: FormValues) => setF((t) => ({ ...t, ...patch })), []);
  const bind = (name: string) => ({
    name,
    value: f[name] === undefined || f[name] === null ? '' : String(f[name]),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((t) => ({ ...t, [name]: e.target.value })),
  });
  const str = (name: string) => String(f[name] ?? '');
  return { f, setF, set, bind, str };
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
  span?: 1 | 2;
  rows?: number;
  autoComplete?: string;
}

export function Field({ label, name, value, onChange, type = 'text', placeholder, span, rows, autoComplete }: FieldProps) {
  return (
    <label className={'field' + (span === 2 ? ' span2' : '')}>
      {label}
      {rows ? (
        <textarea className="input" name={name} rows={rows} value={value} onChange={onChange} placeholder={placeholder} />
      ) : (
        <input className="input" name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} />
      )}
    </label>
  );
}

interface ChipProps { on?: boolean; onClick?: () => void; size?: 'sm' | 'lg' | 'wide' | 'pill'; soft?: boolean; children: ReactNode; style?: CSSProperties }
export function Chip({ on, onClick, size = 'sm', soft, children, style }: ChipProps) {
  const cls = ['chip', size === 'sm' ? '' : size, soft ? 'soft' : '', on ? 'on' : ''].filter(Boolean).join(' ');
  return <button type="button" className={cls} onClick={onClick} aria-pressed={!!on} style={style}>{children}</button>;
}

/** Labelled placeholder block standing in for photography. */
/** Small square preview: the product photo when there is one, otherwise its colour. */
export function Thumb({ tint, img, size = 56, radius = 12 }: { tint: string; img?: string; size?: number; radius?: number }) {
  return <div style={{ width: size, height: size, borderRadius: radius, flex: 'none', border: '1px solid var(--line)', background: tint.toUpperCase() === '#FFFFFF' ? '#F3EADF' : tint, ...(img ? { backgroundImage: 'url(' + img + ')', backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }} />;
}

export function Ph({ tint, label, ratio, stripe, style, children, className }: { tint: string; label?: string; ratio?: string; stripe?: boolean; style?: CSSProperties; children?: ReactNode; className?: string }) {
  return (
    <div className={'ph' + (stripe ? ' stripe' : '') + (className ? ' ' + className : '')} style={{ background: tint, aspectRatio: ratio, ...style }}>
      {label ? 'Image: ' + label : children}
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? <div className="err" role="alert">{typeof children === 'string' ? tr(children) : children}</div> : null;
}

/**
 * A quantity people can type into (handy for 50 candles), not just step with - and +.
 * The new number is applied when they press Enter or leave the box; anything that is not a whole number above 0 puts the old value back.
 */
export function QtyInput({ qty, onSet, max = MAX_QTY, className, style }: { qty: number; onSet: (n: number) => void; max?: number; className?: string; style?: CSSProperties }) {
  const [text, setText] = useState(String(qty));
  useEffect(() => { setText(String(qty)); }, [qty]);
  const commit = () => {
    const n = parseInt(text, 10);
    if (!(n >= 1)) { setText(String(qty)); return; }
    const v = Math.min(max, n);
    setText(String(v));
    if (v !== qty) onSet(v);
  };
  return (
    <input
      className={'qty-input' + (className ? ' ' + className : '')}
      type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
      aria-label={tr('Quantity')}
      value={text}
      onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, String(MAX_QTY).length))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(String(qty)); (e.target as HTMLInputElement).blur(); } }}
      style={{ width: Math.max(2, text.length) + 1.6 + 'ch', ...style }}
    />
  );
}

export function Stepper({ qty, onDec, onInc, onSet, max, small }: { qty: number; onDec: () => void; onInc: () => void; onSet?: (n: number) => void; max?: number; small?: boolean }) {
  return (
    <div className={'stepper' + (small ? ' sm' : '')}>
      <button type="button" onClick={onDec} aria-label={tr('Decrease quantity')}>-</button>
      {onSet ? <QtyInput qty={qty} onSet={onSet} max={max} /> : <span>{qty}</span>}
      <button type="button" onClick={onInc} aria-label={tr('Increase quantity')}>+</button>
    </div>
  );
}

export const Section = ({ children, narrow }: { children: ReactNode; narrow?: number }) => (
  <section className="narrow" style={narrow ? { maxWidth: narrow } : { maxWidth: 'var(--wrap)' }}>{children}</section>
);
