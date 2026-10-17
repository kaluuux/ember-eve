import { useApp } from '../AppContext';
import { Chip } from './ui';
import { CUSTOM, allowedColors, blendFee, normalize, type Selection } from '../commerce';
import { money } from '../store';
import type { Product } from '../types';

/** Option groups, colour swatches and the custom blend picker for one product. Fully driven by the product's data. */
export function Configurator({ p, sel, onChange, size = 'lg' }: { p: Product; sel: Selection; onChange: (s: Selection) => void; size?: 'sm' | 'lg' }) {
  const { colors, settings } = useApp();
  const upd = (o: Partial<Selection>) => onChange(normalize(p, { ...sel, ...o }, colors));
  const allowed = allowedColors(p, sel.opts, colors);
  const canBlend = p.colors && p.custom && allowed.length >= 2;
  const custom = sel.color === CUSTOM;
  const fee = blendFee(p, sel, settings);
  const toggleBlend = (id: string) => upd({ blend: sel.blend.includes(id) ? sel.blend.filter((x) => x !== id) : sel.blend.concat(id) });
  const curName = custom ? 'Custom blend' : colors.find((c) => c.id === sel.color)?.name;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {p.groups.map((g) => (
        <div key={g.id}>
          <div className="label-s">{g.label}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {g.options.map((o) => (
              <Chip key={o.id} size={size === 'lg' ? 'wide' : 'lg'} on={sel.opts[g.id] === o.id} onClick={() => upd({ opts: { ...sel.opts, [g.id]: o.id } })}>
                {o.label}{o.add > 0 ? ` (+${money(o.add)})` : o.add < 0 ? ` (-${money(-o.add)})` : ''}
              </Chip>
            ))}
          </div>
        </div>
      ))}

      {p.colors && (
        <div>
          <div className="label-s">Colour: {curName}{allowed.length === 1 ? ' (only colour for this option)' : ''}</div>
          <div className="swatches" role="radiogroup" aria-label="Colour">
            {allowed.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={sel.color === c.id}
                aria-label={c.name}
                title={c.name}
                className={'swatch' + (sel.color === c.id ? ' on' : '')}
                style={{ background: c.hex }}
                onClick={() => upd({ color: c.id })}
              />
            ))}
            {canBlend && (
              <button type="button" className={'swatch blend' + (custom ? ' on' : '')} aria-checked={custom} role="radio" aria-label="Custom blend" title="Custom blend" onClick={() => upd({ color: CUSTOM, blend: sel.blend.length ? sel.blend : allowed.slice(0, 2).map((c) => c.id) })}>
                +
              </button>
            )}
          </div>
          {custom && (
            <div className="blend-box">
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                Pick 2 or more colours to shade together. The first {settings.freeColors} are free, then +{money(settings.extraColorFee)} for each extra colour.
              </div>
              <div className="swatches" style={{ marginTop: 8 }}>
                {allowed.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={sel.blend.includes(c.id)}
                    aria-label={c.name}
                    title={c.name}
                    className={'swatch' + (sel.blend.includes(c.id) ? ' on' : '')}
                    style={{ background: c.hex }}
                    onClick={() => toggleBlend(c.id)}
                  />
                ))}
              </div>
              <div style={{ fontSize: 13, marginTop: 8, color: sel.blend.length < 2 ? 'var(--red)' : 'var(--text2)' }}>
                {sel.blend.length < 2 ? 'Choose at least 2 colours.' : sel.blend.map((id) => colors.find((c) => c.id === id)?.name).join(' + ') + (fee ? ` · colour fee ${money(fee)}` : ' · no colour fee')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
