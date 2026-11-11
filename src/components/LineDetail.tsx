import { EMPTY, useStored } from '../store';
import { describe, normalize, selectionTint, soft } from '../commerce';
import { useT } from '../i18n';
import type { Color, ItemSel, Product } from '../types';

/** The parts of a basket line or order item this needs; both shapes fit. */
interface LineLike {
  sub: string;
  note?: string;
  box?: { pid: number; name?: string; sel?: ItemSel }[];
}

interface Part { label: string; value: string }
interface Candle { name: string; parts: Part[]; sticker: string; photo: string; tint: string }

/** "Size: Small · Colour: White · Sticker: "Hi"" -> label/value pairs, with the sticker kept apart. */
function splitDesc(desc: string): { parts: Part[]; sticker: string } {
  const parts: Part[] = [];
  let sticker = '';
  desc.split(' · ').map((s) => s.trim()).filter(Boolean).forEach((s) => {
    const i = s.indexOf(': ');
    const label = i > 0 ? s.slice(0, i) : '', value = i > 0 ? s.slice(i + 2) : s;
    if (label === 'Sticker') sticker = value.replace(/^"|"$/g, '');
    else parts.push({ label, value });
  });
  return { parts, sticker };
}

/** Older lines only have the joined text: "Rose Candle [Colour: Red]; Heart Candle [...]". */
function parseSub(sub: string): { name: string; desc: string }[] {
  const out: { name: string; desc: string }[] = [];
  const re = /(?:^|;\s*)([^[;]+?)\s*\[(.*?)\](?=\s*;|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sub))) out.push({ name: m[1].trim(), desc: m[2] });
  return out;
}

/** A gift box line, one candle per row, built from the live catalogue where possible. */
function boxCandles(line: LineLike, products: Product[], palette: Color[]): Candle[] {
  const parsed = parseSub(line.sub);
  return (line.box ?? []).map((b, i) => {
    const p = products.find((x) => x.id === b.pid);
    const sel = p && b.sel ? normalize(p, { ...b.sel, qty: 1 }, palette) : null;
    const desc = p && sel ? describe(p, sel, palette) : parsed[i]?.desc ?? '';
    const { parts, sticker } = splitDesc(desc);
    return {
      name: b.name || p?.name || parsed[i]?.name || 'Candle',
      parts, sticker,
      photo: p?.images?.[0] ?? '',
      tint: soft(sel ? selectionTint(sel, palette) : '#EADFD3'),
    };
  });
}

/** First candle photo in a gift box, for its basket thumbnail. */
export function boxPhoto(line: LineLike, products: Product[]): string {
  return (line.box ?? []).map((b) => products.find((p) => p.id === b.pid)?.images?.[0]).find(Boolean) ?? '';
}

/**
 * What is in a basket line or order item. Single candles keep their one-line description;
 * gift boxes get a clear list: each candle on its own row with a small photo, its choices as tags,
 * any sticker message, and the gift note at the end.
 */
export function LineDetail({ line, compact }: { line: LineLike; compact?: boolean }) {
  const t = useT();
  const products = useStored<Product[]>('products', EMPTY);
  const palette = useStored<Color[]>('colors', EMPTY);

  if (!line.box?.length) {
    return <div className="muted">{line.sub}{line.note ? ' · ' + t('Gift note') + ': "' + line.note + '"' : ''}</div>;
  }
  const candles = boxCandles(line, products, palette);
  return (
    <div className={'ld' + (compact ? ' ld-compact' : '')}>
      <ol className="ld-list">
        {candles.map((c, i) => (
          <li key={i} className="ld-item">
            <span className="ld-thumb" style={c.photo ? { backgroundImage: 'url(' + c.photo + ')' } : { background: c.tint }} aria-hidden="true" />
            <div className="ld-body">
              <div className="ld-name"><span className="ld-n">{i + 1}</span>{c.name}</div>
              {c.parts.length > 0 && (
                <div className="ld-tags">
                  {c.parts.map((p, j) => <span key={j} className="ld-tag">{p.label && <i>{p.label}</i>}{p.value}</span>)}
                </div>
              )}
              {c.sticker && <div className="ld-sticker">{t('Sticker')}: “{c.sticker}”</div>}
            </div>
          </li>
        ))}
      </ol>
      {line.note && <div className="ld-note"><b>{t('Gift note')}</b> “{line.note}”</div>}
    </div>
  );
}
