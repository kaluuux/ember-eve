import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';

const clamp01 = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

const FLAME = (
  <>
    <path d="M0 4 C-17 -16 -15 -52 0 -88 C15 -52 17 -16 0 4Z" fill="url(#fl)" />
    <path d="M0 0 C-7 -10 -6 -28 0 -44 C6 -28 7 -10 0 0Z" fill="#FFF6D6" />
  </>
);

/** A small shaped candle's flame: glow halo plus a flame scaled in by the scroll handler. */
function Flame({ at, dur }: { at: number; dur: number }) {
  return (
    <g transform={`translate(0 ${at})`}>
      <circle data-sglow cx="0" cy="-10" r="70" fill="url(#sg)" opacity="0" />
      <g data-sfs transform="scale(0)">
        <g style={{ animation: `flick ${dur}s ease-in-out infinite`, transformBox: 'fill-box', transformOrigin: '50% 100%' }}>{FLAME}</g>
      </g>
    </g>
  );
}

/** Scroll-driven hero: a jar candle ignites and burns down as the page scrolls. */
export function Hero() {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  // on a phone the scene is cropped to the candles so they fill the width
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 760px)');
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    const q = <T extends Element = SVGElement>(s: string) => r.querySelector<T>(s)!;
    const qa = (s: string) => r.querySelectorAll<SVGElement>(s);
    const wax = q('[data-wax]'), tint = q('[data-tint]'), rim = q('[data-rim]'), liq = q('[data-liq]'), wick = q('[data-wick]');
    const ember = q('[data-ember]'), fpos = q('[data-fpos]'), fscale = q('[data-fscale]'), pool = q('[data-pool]');
    const glow = q<HTMLElement>('[data-glow]'), bar = q<HTMLElement>('[data-bar]'), hint = q<HTMLElement>('[data-hint]');
    const steps = r.querySelectorAll<HTMLElement>('[data-step]');
    const smalls = qa('[data-sfs]'), halos = qa('[data-sglow]');

    const onScroll = () => {
      const stage = r.firstElementChild as HTMLElement;
      const off = parseFloat(getComputedStyle(stage).top) || 0;
      const total = r.offsetHeight - stage.offsetHeight;
      const p = total > 0 ? clamp01(0, 1, (off - r.getBoundingClientRect().top) / total) : 0;
      const ign = ease(clamp01(0.1, 0.28, p)), grow = ease(clamp01(0.28, 0.95, p)), em = clamp01(0.02, 0.1, p) * (1 - ign);
      const top = 372 + 60 * grow, fy = top - 22;
      const sv = [0.36, 0.46, 0.56, 0.66].map((s0) => ease(clamp01(s0, s0 + 0.08, p)));
      smalls.forEach((n, i) => n.setAttribute('transform', 'scale(' + (sv[i] * 0.42).toFixed(3) + ')'));
      halos.forEach((n, i) => n.setAttribute('opacity', String(sv[i] * 0.9)));
      wax.setAttribute('y', String(top)); wax.setAttribute('height', String(512 - top));
      tint.setAttribute('opacity', String(ign * (0.4 + 0.6 * grow)));
      r.style.background = `rgb(${mix(27, 58, grow)},${mix(29, 42, grow)},${mix(31, 30, grow)})`;
      rim.setAttribute('cy', String(top));
      liq.setAttribute('cy', String(top)); liq.setAttribute('rx', String(20 + 58 * Math.min(1, ign * 0.4 + grow))); liq.setAttribute('opacity', String(ign));
      wick.setAttribute('y1', String(top)); wick.setAttribute('y2', String(fy));
      ember.setAttribute('cy', String(fy)); ember.setAttribute('opacity', String(em));
      fpos.setAttribute('transform', `translate(260 ${fy})`); fpos.setAttribute('opacity', String(ign));
      fscale.setAttribute('transform', 'scale(' + (ign * 0.85 * (1 + 0.15 * grow)).toFixed(3) + ')');
      glow.style.opacity = String(ign * (0.55 + 0.45 * grow));
      const vb = (r.querySelector('svg[data-scene]') as SVGSVGElement).viewBox.baseVal;
      glow.style.top = ((fy - 35 - vb.y) / vb.height) * 100 + '%';
      glow.style.transform = 'scale(' + (0.2 + 0.9 * ign * (0.6 + 0.4 * grow)).toFixed(3) + ')';
      pool.setAttribute('opacity', String(ign * (0.5 + 0.5 * grow)));
      bar.style.width = p * 100 + '%';
      hint.style.opacity = String(Math.max(0, 1 - p * 8));
      const act = p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.7 ? 2 : 3;
      steps.forEach((e, i) => { e.style.color = i === act ? '#fff' : '#9AA0A3'; });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section ref={ref} style={{ position: 'relative', height: '300vh', background: '#1B1D1F', color: '#fff' }}>
      <div className="hero-stage">
        <div style={{ position: 'absolute', left: 0, top: 0, height: 2, width: '100%', background: 'rgba(255,255,255,0.08)', zIndex: 3 }}>
          <div data-bar style={{ height: 2, width: '0%', background: '#A67C52' }} />
        </div>
        <div className="hero-grid">
          <div className="hero-text" style={{ position: 'relative', zIndex: 2 }}>
            <div className="hero-eyebrow">{t('Light up your little moments')}</div>
            <h1 className="hero-title">{t('Light something that feels like home.')}</h1>
            <p className="hero-p" style={{ fontSize: 18, lineHeight: '28px', color: '#D9CCBF', margin: '0 0 28px', maxWidth: 480 }}>
              {t('Hand-poured soy wax candles in mold, glass and jar. Choose your colour, or blend your own, or build a gift box for someone you love.')}
            </p>
            <div className="hero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/shop" className="hero-cta solid">{t('Shop Candles')}</a>
              <a href="/finder" className="hero-cta line">{t('Find My Colour')}</a>
            </div>
            <div className="hero-steps" style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap', fontSize: 14, fontWeight: 500 }}>
              {['01 Unlit', '02 Jar ignites', '03 The collection', '04 Burn down'].map((s, i) => (
                <span key={s} data-step style={{ color: i === 0 ? '#fff' : '#9AA0A3' }}>{t(s)}</span>
              ))}
            </div>
            <div data-hint style={{ marginTop: 16, fontSize: 14, color: '#CDBFB1' }}>{t('Scroll to light the candle')}</div>
          </div>
          <div className="hero-art" style={phone ? { aspectRatio: '460 / 410' } : undefined}>
            <div
              data-glow
              style={{ position: 'absolute', left: '50%', top: '50%', width: 1600, height: 1600, margin: '-800px 0 0 -800px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,190,100,0.5) 0%,rgba(214,150,80,0.22) 22%,rgba(166,124,82,0) 55%)', opacity: 0, transform: 'scale(0.2)', pointerEvents: 'none' }}
            />
            <svg data-scene viewBox={phone ? '30 190 460 410' : '0 0 520 600'} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }} role="img" aria-label={t('Glass jar candle and shaped candles lighting as you scroll')}>
              <defs>
                <linearGradient id="wx" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#E2CDB0" /><stop offset="0.35" stopColor="#F6EBDA" /><stop offset="1" stopColor="#D2BA98" /></linearGradient>
                <linearGradient id="fl" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="#FF7A1F" /><stop offset="0.55" stopColor="#FFB54A" /><stop offset="1" stopColor="#FFE9A8" /></linearGradient>
                <radialGradient id="sg"><stop offset="0" stopColor="rgba(255,190,100,0.5)" /><stop offset="1" stopColor="rgba(255,190,100,0)" /></radialGradient>
              </defs>
              <ellipse data-pool cx="260" cy="532" rx="270" ry="26" fill="rgba(255,176,86,0.22)" opacity="0" />
              <ellipse cx="260" cy="532" rx="250" ry="14" fill="#2F3335" stroke="rgba(255,255,255,0.1)" />

              {/* butterfly */}
              <g transform="translate(75 520)">
                <ellipse cx="-19" cy="-50" rx="26" ry="19" transform="rotate(-25 -19 -50)" fill="#E3D3F2" />
                <ellipse cx="19" cy="-50" rx="26" ry="19" transform="rotate(25 19 -50)" fill="#E3D3F2" />
                <ellipse cx="-14" cy="-28" rx="17" ry="13" transform="rotate(20 -14 -28)" fill="#D2BCEA" />
                <ellipse cx="14" cy="-28" rx="17" ry="13" transform="rotate(-20 14 -28)" fill="#D2BCEA" />
                <rect x="-4" y="-60" width="8" height="54" rx="4" fill="#B79BD8" />
                <line x1="0" y1="-60" x2="0" y2="-68" stroke="#2A2A2A" strokeWidth="2.5" strokeLinecap="round" />
                <Flame at={-68} dur={1.3} />
              </g>
              {/* heart */}
              <g transform="translate(150 520)">
                <path d="M0 0 C-40 -26 -28 -62 -12 -58 C-6 -57 -2 -52 0 -46 C2 -52 6 -57 12 -58 C28 -62 40 -26 0 0Z" fill="#F5C6D6" />
                <line x1="0" y1="-46" x2="0" y2="-54" stroke="#2A2A2A" strokeWidth="2.5" strokeLinecap="round" />
                <Flame at={-54} dur={1.45} />
              </g>
              {/* bubble */}
              <g transform="translate(385 520)">
                <circle cx="0" cy="-22" r="22" fill="#DCEBF7" />
                <circle cx="0" cy="-56" r="16" fill="#CFE2F3" />
                <circle cx="0" cy="-80" r="11" fill="#C2D9EE" />
                <line x1="0" y1="-91" x2="0" y2="-99" stroke="#2A2A2A" strokeWidth="2.5" strokeLinecap="round" />
                <Flame at={-99} dur={1.6} />
              </g>
              {/* flower */}
              <g transform="translate(460 520)">
                <ellipse cx="0" cy="-4" rx="22" ry="5" fill="#9DBFA5" />
                <g fill="#F9D9B8">
                  <ellipse cx="0" cy="-28" rx="10" ry="23" transform="rotate(-70 0 -4)" />
                  <ellipse cx="0" cy="-28" rx="10" ry="23" transform="rotate(70 0 -4)" />
                  <ellipse cx="0" cy="-28" rx="10" ry="23" transform="rotate(-35 0 -4)" />
                  <ellipse cx="0" cy="-28" rx="10" ry="23" transform="rotate(35 0 -4)" />
                </g>
                <ellipse cx="0" cy="-28" rx="10" ry="23" fill="#F4C79B" />
                <line x1="0" y1="-50" x2="0" y2="-58" stroke="#2A2A2A" strokeWidth="2.5" strokeLinecap="round" />
                <Flame at={-58} dur={1.75} />
              </g>

              {/* the jar */}
              <rect data-wax x="180" y="372" width="160" height="140" rx="6" fill="url(#wx)" />
              <ellipse data-rim cx="260" cy="372" rx="80" ry="8" fill="#EBD9BE" />
              <ellipse data-liq cx="260" cy="372" rx="20" ry="5" fill="#E0B070" opacity="0" />
              <rect data-tint x="175" y="330" width="170" height="190" rx="20" fill="rgba(255,160,70,0.2)" opacity="0" />
              <rect x="175" y="330" width="170" height="190" rx="20" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <ellipse cx="260" cy="332" rx="85" ry="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <rect x="187" y="348" width="7" height="140" rx="3.5" fill="rgba(255,255,255,0.3)" />
              <rect x="205" y="452" width="110" height="54" rx="4" fill="#F3EBE1" />
              <text x="260" y="476" textAnchor="middle" fontFamily="Libre Caslon Text,Georgia,serif" fontSize="16" fill="#26292B">{t('Ember & Eve')}</text>
              <text x="260" y="493" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="8" fontWeight="600" letterSpacing="1.6" fill="#8F6642">{t('VANILLA · 200G')}</text>
              <line data-wick x1="260" y1="372" x2="260" y2="350" stroke="#2A2A2A" strokeWidth="3" strokeLinecap="round" />
              <circle data-ember cx="260" cy="350" r="3.5" fill="#FF8A2B" opacity="0" />
              <g data-fpos transform="translate(260 350)" opacity="0">
                <g data-fscale transform="scale(0)">
                  <g style={{ animation: 'flick 1.6s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                    {FLAME}
                    <ellipse cx="0" cy="-2" rx="5" ry="7" fill="rgba(90,130,255,0.55)" />
                  </g>
                </g>
                <circle cx="-4" cy="-60" r="1.8" fill="#FFC96B" style={{ animation: 'rise1 3.2s ease-out infinite' }} />
                <circle cx="5" cy="-60" r="1.4" fill="#FFB54A" style={{ animation: 'rise2 4s ease-out infinite 1.1s' }} />
                <circle cx="0" cy="-60" r="1.6" fill="#FFD98C" style={{ animation: 'rise3 3.6s ease-out infinite 2s' }} />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
