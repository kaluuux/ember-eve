import { useState } from 'react';
import { useApp } from '../AppContext';
import { DEFAULT_COLORS } from '../store';
import { Reveal } from './Flair';
import { useT } from '../i18n';

const lighten = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/** A candle that takes on whichever colours you pick: one colour, or a blend of up to three. */
export function ColourStudio() {
  const t = useT();
  const { colors, settings, categories } = useApp();
  const palette = colors.length ? colors : DEFAULT_COLORS;
  const [picked, setPicked] = useState<string[]>([palette[Math.min(7, palette.length - 1)].id]);
  const [mix, setMix] = useState(false);

  const chosen = picked.map((id) => palette.find((c) => c.id === id)).filter((c): c is (typeof palette)[number] => !!c);
  const first = chosen[0] ?? palette[0];
  const toggle = (id: string) => {
    if (!mix) return setPicked([id]);
    setPicked((p) => (p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : p.length >= 3 ? [...p.slice(1), id] : [...p, id]));
  };
  const name = chosen.map((c) => c.name).join(' + ');
  const href = '/shop' + (categories[0] ? '?cat=' + categories[0].id : '');

  return (
    <section className="studio" aria-labelledby="studio-h">
      <div className="studio-grid">
        <Reveal className="studio-stage">
          <div className="halo" style={{ background: `radial-gradient(circle, ${lighten(first.hex, 0.35)} 0%, ${lighten(first.hex, 0.7)}66 38%, transparent 68%)` }} />
          <svg viewBox="0 0 320 420" role="img" aria-label={'A candle in ' + name}>
            <defs>
              <linearGradient id="studio-wax" x1="0" y1="0" x2="0" y2="1">
                {chosen.length === 1
                  ? <><stop offset="0" stopColor={lighten(first.hex, 0.18)} /><stop offset="1" stopColor={first.hex} /></>
                  : chosen.map((c, i) => <stop key={c.id} offset={i / (chosen.length - 1)} stopColor={c.hex} />)}
              </linearGradient>
              <linearGradient id="studio-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#FF8A2B" /><stop offset="0.55" stopColor="#FFC04D" /><stop offset="1" stopColor="#FFF0B8" /></linearGradient>
              <radialGradient id="studio-fg"><stop offset="0" stopColor="rgba(255,210,130,.75)" /><stop offset="1" stopColor="rgba(255,210,130,0)" /></radialGradient>
            </defs>
            <ellipse cx="160" cy="388" rx="104" ry="12" fill="rgba(70,45,20,.16)" />
            <rect x="72" y="170" width="176" height="212" rx="30" fill="url(#studio-wax)" style={{ transition: 'fill .6s' }} />
            <ellipse cx="160" cy="172" rx="88" ry="11" fill={lighten(first.hex, 0.45)} style={{ transition: 'fill .6s' }} />
            <ellipse cx="160" cy="173" rx="30" ry="5" fill="rgba(255,255,255,.55)" />
            <rect x="72" y="150" width="176" height="236" rx="32" fill="rgba(255,255,255,.28)" stroke="rgba(120,90,60,.35)" strokeWidth="2" />
            <rect x="86" y="170" width="8" height="170" rx="4" fill="rgba(255,255,255,.55)" />
            <rect x="106" y="262" width="108" height="64" rx="6" fill="#FBF8F3" stroke="rgba(143,102,66,.25)" />
            <text x="160" y="289" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="22" fontWeight="600" fill="#2A2623">{t('Ember & Eve')}</text>
            <text x="160" y="308" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fontWeight="600" letterSpacing="1.8" fill="#8F6642">{(chosen.length > 1 ? 'CUSTOM BLEND' : first.name).toUpperCase()}</text>
            <line x1="160" y1="172" x2="160" y2="146" stroke="#2A2623" strokeWidth="3" strokeLinecap="round" />
            <circle cx="160" cy="128" r="46" fill="url(#studio-fg)" style={{ animation: 'glowPulse 3s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
            <g className="flame-g">
              <path d="M160 150 C146 134 148 108 160 84 C172 108 174 134 160 150Z" fill="url(#studio-flame)" />
              <path d="M160 148 C154 140 155 124 160 112 C165 124 166 140 160 148Z" fill="#FFF8DE" />
            </g>
          </svg>
        </Reveal>

        <Reveal delay={120}>
          <span className="eyebrow">{t('Colour studio')}</span>
          <h2 id="studio-h" className="h2">{t('Make it yours, one shade at a time')}</h2>
          <p className="lede" style={{ margin: '14px 0 22px' }}>
            {t('Choose from our palette, or blend two or three colours for a shade nobody else has. The first {n} colours in a blend are free.', { n: settings.freeColors })}
          </p>
          <div className="studio-name" aria-live="polite">{name}</div>
          <div className="swatches" role="group" aria-label={t('Pick a colour')} style={{ margin: '14px 0 20px' }}>
            {palette.map((c) => (
              <button key={c.id} type="button" className={'swatch' + (picked.includes(c.id) ? ' on' : '')} style={{ background: c.hex }} aria-label={c.name} aria-pressed={picked.includes(c.id)} title={c.name} onClick={() => toggle(c.id)} />
            ))}
            <button type="button" className={'swatch swatch-mix' + (mix ? ' on' : '')} aria-pressed={mix} onClick={() => { setMix(!mix); if (mix) setPicked((p) => [p[0]]); }}>{mix ? t('Blending: pick up to 3') : t('+ Blend colours')}</button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={href} className="btn">{t('Shop & customise')}</a>
            <a href="/finder" className="btn ghost">{t('Help me choose')}</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
