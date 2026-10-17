import { useApp } from '../AppContext';
import { Chip } from './ui';
import { CUSTOM, STICKER_MAX, allowedColors, blendFee, normalize, type Selection } from '../commerce';
import { money } from '../store';
import type { Product } from '../types';
import { useT } from '../i18n';

/** Option groups, colour swatches and the custom blend picker for one product. Fully driven by the product's data. */
export function Configurator({ p, sel, onChange, size = 'lg' }: { p: Product; sel: Selection; onChange: (s: Selection) => void; size?: 'sm' | 'lg' }) {
  const t = useT();
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
          <div className="label-s">{t('Colour:')}{' '}{curName}{allowed.length === 1 ? t(' (only colour for this option)') : ''}</div>
          <div className="swatches" role="radiogroup" aria-label={t('Colour')}>
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
              <button type="button" className={'swatch blend' + (custom ? ' on' : '')} aria-checked={custom} role="radio" aria-label={t('Custom blend')} title={t('Custom blend')} onClick={() => upd({ color: CUSTOM, blend: sel.blend.length ? sel.blend : allowed.slice(0, 2).map((c) => c.id) })}>
                +
              </button>
            )}
          </div>
          {custom && (
            <div className="blend-box">
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {t('Pick 2 or more colours to shade together. The first {n} are free, then +{fee} for each extra colour.', { n: settings.freeColors, fee: money(settings.extraColorFee) })}
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
                {sel.blend.length < 2 ? t('Choose at least 2 colours.') : sel.blend.map((id) => colors.find((c) => c.id === id)?.name).join(' + ') + (fee ? ` · colour fee ${money(fee)}` : ' · no colour fee')}
              </div>
            </div>
          )}
        </div>
      )}

      {p.sticker && (
        <div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            <input type="checkbox" checked={sel.sticker !== undefined} onChange={(e) => upd({ sticker: e.target.checked ? '' : undefined })} style={{ width: 18, height: 18, accentColor: '#8F6642' }} />
            {t('Add a custom message or quote on the sticker')}{' '}<span style={{ color: 'var(--green)', fontWeight: 600 }}>{t('(free)')}</span>
          </label>
          {sel.sticker !== undefined && (
            <div style={{ marginTop: 8 }}>
              <input className="input" maxLength={STICKER_MAX} value={sel.sticker} onChange={(e) => upd({ sticker: e.target.value })} placeholder={t('e.g. Happy Birthday Amma')} aria-label={t('Sticker message')} />
              <div className="muted" style={{ fontSize: 12, textAlign: 'right', marginTop: 2 }}>{sel.sticker.length}/{STICKER_MAX}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
