import { useCallback, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { tr } from '../i18n';

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

export function Stepper({ qty, onDec, onInc, small }: { qty: number; onDec: () => void; onInc: () => void; small?: boolean }) {
  return (
    <div className={'stepper' + (small ? ' sm' : '')}>
      <button type="button" onClick={onDec} aria-label="Decrease quantity">-</button>
      <span>{qty}</span>
      <button type="button" onClick={onInc} aria-label="Increase quantity">+</button>
    </div>
  );
}

export const Section = ({ children, narrow }: { children: ReactNode; narrow?: number }) => (
  <section className="narrow" style={narrow ? { maxWidth: narrow } : { maxWidth: 'var(--wrap)' }}>{children}</section>
);
