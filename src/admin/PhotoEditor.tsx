import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

export type Folder = 'products' | 'categories' | 'gallery';
/** A place the photo appears on the site. Ratios are width / height, copied from the storefront CSS. */
interface Frame { label: string; desktop: number; mobile: number }

const SPEC: Record<Folder, { frames: Frame[]; note: string }> = {
  // card: square on desktop, 1 / 1.02 on phones · product page gallery: square on desktop, 1 / 0.86 on phones
  products: {
    frames: [{ label: 'Shop card', desktop: 1, mobile: 1 / 1.02 }, { label: 'Product page', desktop: 1, mobile: 1 / 0.86 }],
    note: 'The shop shows photos square, and a little wider than tall on phones. A square crop keeps everything you chose; any other shape is trimmed to fit.',
  },
  categories: { frames: [{ label: 'Home tile', desktop: 4 / 3, mobile: 4 / 3 }], note: 'Home page tiles are 4:3 (landscape).' },
  gallery: { frames: [{ label: 'Home gallery', desktop: 4 / 5, mobile: 4 / 5 }], note: 'Home gallery photos are 4:5 (portrait).' },
};

/** Shapes to snap the crop to. 'free' lets you pull any side to any size. */
const ASPECTS: [string, string, number][] = [['free', 'Free', 0], ['orig', 'Original', -1], ['1:1', 'Square', 1], ['4:5', 'Portrait 4:5', 4 / 5], ['4:3', 'Landscape 4:3', 4 / 3], ['16:9', 'Wide 16:9', 16 / 9]];

export type CropResult = Blob | 'original' | null;

/* ------------------------------------------------------------------ geometry */
/** The crop box as fractions (0 to 1) of the rotated photo */
interface Rect { x: number; y: number; w: number; h: number }
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.05;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

function dims(img: HTMLImageElement, rot: number) {
  const odd = rot % 2 === 1;
  return { sw: odd ? img.naturalHeight : img.naturalWidth, sh: odd ? img.naturalWidth : img.naturalHeight };
}

/** Draw the chosen part of the (rotated) photo into a canvas outW wide. */
function paint(canvas: HTMLCanvasElement, img: HTMLImageElement, rot: number, r: Rect, outW: number) {
  const { sw, sh } = dims(img, rot);
  const rw = r.w * sw, rh = r.h * sh;
  canvas.width = outW; canvas.height = Math.max(1, Math.round((outW * rh) / rw));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(outW / rw, outW / rw);
  ctx.translate(-r.x * sw, -r.y * sh);
  if (rot === 1) { ctx.translate(sw, 0); ctx.rotate(Math.PI / 2); }
  else if (rot === 2) { ctx.translate(sw, sh); ctx.rotate(Math.PI); }
  else if (rot === 3) { ctx.translate(0, sh); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Largest centred box of a given pixel shape inside the photo. */
function fitBox(lock: number, sw: number, sh: number): Rect {
  const ar = (lock * sh) / sw; // width / height as fractions
  const w = ar >= 1 ? 1 : ar, h = ar >= 1 ? 1 / ar : 1;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/**
 * Drag one handle by (dx, dy) (fractions of the photo). Edges and corners move the sides they touch.
 * `ar` is width / height in fractions: 0 means free, otherwise the shape is kept and the box stays on the photo.
 */
function resize(r: Rect, h: string, dx: number, dy: number, ar: number): Rect {
  let x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
  if (h.includes('w')) x1 = clamp(x1 + dx, 0, x2 - MIN);
  if (h.includes('e')) x2 = clamp(x2 + dx, x1 + MIN, 1);
  if (h.includes('n')) y1 = clamp(y1 + dy, 0, y2 - MIN);
  if (h.includes('s')) y2 = clamp(y2 + dy, y1 + MIN, 1);
  if (!ar) return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };

  let w = x2 - x1, hh = y2 - y1;
  const horiz = h === 'e' || h === 'w', vert = h === 'n' || h === 's';
  if (horiz) hh = w / ar; else if (vert) w = hh * ar; else if (w / ar > hh) hh = w / ar; else w = hh * ar;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  // the corner (or edge) opposite the handle stays put
  const ax = h.includes('w') ? r.x + r.w : r.x, ay = h.includes('n') ? r.y + r.h : r.y;
  const availW = vert ? 2 * Math.min(cx, 1 - cx) : h.includes('w') ? ax : 1 - ax;
  const availH = horiz ? 2 * Math.min(cy, 1 - cy) : h.includes('n') ? ay : 1 - ay;
  const k = Math.min(1, availW / w, availH / hh);
  w *= k; hh *= k;
  if (w < MIN) { w = MIN; hh = w / ar; }
  if (hh < MIN) { hh = MIN; w = hh * ar; }
  const x = vert ? cx - w / 2 : h.includes('w') ? ax - w : ax;
  const y = horiz ? cy - hh / 2 : h.includes('n') ? ay - hh : ay;
  return { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - hh), w, h: hh };
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HPOS: Record<string, CSSProperties> = {
  nw: { left: 0, top: 0 }, n: { left: '50%', top: 0 }, ne: { left: '100%', top: 0 }, e: { left: '100%', top: '50%' },
  se: { left: '100%', top: '100%' }, s: { left: '50%', top: '100%' }, sw: { left: 0, top: '100%' }, w: { left: 0, top: '50%' },
};

/* -------------------------------------------------------------------- editor */
export function PhotoEditor({ src, folder, n, of, onClose }: { src: File | string; folder: Folder; n: number; of: number; onClose: (r: CropResult) => void }) {
  const { frames, note } = SPEC[folder];
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [rot, setRot] = useState(0);
  const [rect, setRect] = useState<Rect>(FULL);
  const [aspect, setAspect] = useState('free');
  const [guide, setGuide] = useState(true);
  const [prev, setPrev] = useState('');
  const [busy, setBusy] = useState(false);
  const base = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: string; sx: number; sy: number; r0: Rect } | null>(null);

  // load the photo (a new file, or an uploaded one being adjusted again)
  useEffect(() => {
    let url = '', live = true;
    const im = new Image();
    if (typeof src === 'string') { if (!src.startsWith('data:')) im.crossOrigin = 'anonymous'; im.src = src; }
    else { url = URL.createObjectURL(src); im.src = url; }
    // a cleaned-up run (React StrictMode runs effects twice) must not report its own cancelled load
    im.onload = () => { if (live) setImg(im); };
    im.onerror = () => { if (live) setLoadErr(typeof src === 'string' ? 'This photo could not be opened for editing. Remove it and add it again.' : 'That file is not a readable image. Use a JPG, PNG or WebP photo.'); };
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [src]);

  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const size = useMemo(() => (img ? dims(img, rot) : { sw: 1, sh: 1 }), [img, rot]);
  const lockOf = (key: string) => { const a = ASPECTS.find((x) => x[0] === key)!; return a[2] === -1 ? size.sw / size.sh : a[2]; };
  const lock = lockOf(aspect);
  const ar = lock ? (lock * size.sh) / size.sw : 0;

  // the whole photo, shown behind the crop box (rebuilt when it is rotated)
  useEffect(() => {
    if (!img || !base.current) return;
    paint(base.current, img, rot, FULL, Math.min(size.sw, 960));
  }, [img, rot, size.sw]);

  // small previews of the crop, repainted as it changes
  useEffect(() => {
    if (!img) return;
    const raf = requestAnimationFrame(() => {
      const t = document.createElement('canvas');
      paint(t, img, rot, rect, Math.min(420, Math.max(60, Math.round(rect.w * size.sw))));
      setPrev(t.toDataURL('image/jpeg', 0.82));
    });
    return () => cancelAnimationFrame(raf);
  }, [img, rot, rect, size.sw]);

  const cropAspect = (rect.w * size.sw) / (rect.h * size.sh);
  // the part of the crop that every frame (desktop and phone) always shows
  let vFrac = 1, hFrac = 1;
  frames.forEach((f) => [f.desktop, f.mobile].forEach((r) => { if (r > cropAspect) vFrac = Math.min(vFrac, cropAspect / r); else if (r < cropAspect) hFrac = Math.min(hFrac, r / cropAspect); }));
  const showGuide = guide && (vFrac < 0.995 || hFrac < 0.995);

  const pick = (key: string) => { setAspect(key); const l = lockOf(key); setRect(l ? fitBox(l, size.sw, size.sh) : rect); };
  const turn = (d: number) => {
    if (!img) return;
    const nr = (rot + d + 4) % 4, nd = dims(img, nr);
    setRot(nr);
    const a = ASPECTS.find((x) => x[0] === aspect)!;
    setRect(a[2] === 0 ? FULL : fitBox(a[2] === -1 ? nd.sw / nd.sh : a[2], nd.sw, nd.sh));
  };
  const reset = () => { setRot(0); setAspect('free'); setRect(FULL); };

  const grab = (h: string) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { h, sx: e.clientX, sy: e.clientY, r0: rect }; },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = drag.current;
      if (!d || d.h !== h || !wrap.current) return;
      const b = wrap.current.getBoundingClientRect();
      const dx = (e.clientX - d.sx) / b.width, dy = (e.clientY - d.sy) / b.height;
      setRect(h === 'move' ? { ...d.r0, x: clamp(d.r0.x + dx, 0, 1 - d.r0.w), y: clamp(d.r0.y + dy, 0, 1 - d.r0.h) } : resize(d.r0, h, dx, dy, ar));
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
  });
  const onKey = (e: ReactKeyboardEvent) => {
    const s = e.shiftKey ? 0.05 : 0.01;
    const m: Record<string, [number, number]> = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
    if (!m[e.key]) return;
    e.preventDefault();
    setRect((r) => ({ ...r, x: clamp(r.x + m[e.key][0], 0, 1 - r.w), y: clamp(r.y + m[e.key][1], 0, 1 - r.h) }));
  };

  const apply = async () => {
    if (!img) return;
    setBusy(true);
    const t = document.createElement('canvas');
    paint(t, img, rot, rect, Math.min(1600, Math.max(100, Math.round(rect.w * size.sw))));
    const blob = await new Promise<Blob | null>((res) => t.toBlob(res, 'image/jpeg', 0.9));
    setBusy(false);
    onClose(blob ?? 'original');
  };

  const p = (v: number) => v * 100 + '%';
  const x2 = rect.x + rect.w, y2 = rect.y + rect.h;
  const full = rect.w > 0.999 && rect.h > 0.999;

  return (
    <>
      <div className="pe-scrim" onClick={() => onClose(null)} />
      <div className="pe-dialog" role="dialog" aria-modal="true" aria-label="Crop and adjust photo" tabIndex={-1} ref={dialog}>
        <div className="pe-head">
          <div className="h3">Crop and adjust{of > 1 ? ' · photo ' + n + ' of ' + of : ''}</div>
          <button type="button" className="pe-x" aria-label="Close" onClick={() => onClose(null)}>✕</button>
        </div>

        {loadErr ? (
          <div className="pe-body"><div className="err" role="alert">{loadErr}</div></div>
        ) : !img ? (
          <div className="pe-body muted">Loading photo…</div>
        ) : (
          <div className="pe-body">
            <div className="pe-left">
              <div className="pe-stagewrap" ref={wrap} style={{ width: `min(100%, 440px, calc(44vh * ${size.sw / size.sh}))`, aspectRatio: String(size.sw / size.sh) }}>
                <canvas ref={base} className="pe-stage" aria-label="Your photo" />
                <div className="pe-dim" style={{ clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${p(rect.x)} ${p(rect.y)}, ${p(rect.x)} ${p(y2)}, ${p(x2)} ${p(y2)}, ${p(x2)} ${p(rect.y)}, ${p(rect.x)} ${p(rect.y)})` }} />
                <div
                  className="pe-box" tabIndex={0} role="group" aria-label="Crop box. Drag to move it, drag a side or corner to resize it, or use the arrow keys to move it."
                  style={{ left: p(rect.x), top: p(rect.y), width: p(rect.w), height: p(rect.h) }}
                  onKeyDown={onKey} {...grab('move')}
                >
                  {showGuide && <div className="pe-guide" style={{ width: hFrac * 100 + '%', height: vFrac * 100 + '%' }}><span>Always visible</span></div>}
                  {HANDLES.map((h) => <span key={h} className={'pe-h h-' + h} style={HPOS[h]} {...grab(h)}><i /></span>)}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{Math.round(rect.w * size.sw)} × {Math.round(rect.h * size.sh)} px{full ? ' · whole photo' : ''}</div>
              <div className="pe-controls">
                <div className="pe-row" role="group" aria-label="Crop shape">
                  {ASPECTS.map(([k, l]) => <button key={k} type="button" className="btn-xs" aria-pressed={aspect === k} style={aspect === k ? { background: '#26292B', color: '#fff', borderColor: '#26292B' } : undefined} onClick={() => pick(k)}>{l}</button>)}
                </div>
                <div className="pe-row">
                  <button type="button" className="btn-xs" onClick={() => turn(-1)} aria-label="Rotate left">⟲ Rotate</button>
                  <button type="button" className="btn-xs" onClick={() => turn(1)} aria-label="Rotate right">Rotate ⟳</button>
                  <button type="button" className="btn-xs" onClick={reset}>Reset</button>
                </div>
                <label className="pe-check"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Show the area that is always visible</label>
              </div>
            </div>

            <div className="pe-right">
              <div className="pe-title">How it will look</div>
              {frames.map((f) => (
                <div key={f.label} className="pe-frame">
                  <div className="pe-flabel">{f.label}</div>
                  <div className="pe-devices">
                    <figure><div className="pe-pv" style={{ width: 150, aspectRatio: String(f.desktop) }}>{prev && <img src={prev} alt="" />}</div><figcaption>Desktop</figcaption></figure>
                    <figure><div className="pe-pv pe-phone" style={{ width: 96, aspectRatio: String(f.mobile) }}>{prev && <img src={prev} alt="" />}</div><figcaption>Mobile</figcaption></figure>
                  </div>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>{note}</p>
            </div>
          </div>
        )}

        <div className="pe-foot">
          <button type="button" className="btn ghost" onClick={() => onClose(null)}>{of > 1 ? 'Skip this photo' : 'Cancel'}</button>
          {typeof src !== 'string' && <button type="button" className="btn ghost" onClick={() => onClose('original')} disabled={!!loadErr}>Use original</button>}
          <button type="button" className="btn" onClick={() => void apply()} disabled={!img || busy}>{busy ? 'Saving…' : typeof src === 'string' ? 'Save changes' : 'Crop and upload'}</button>
        </div>
      </div>
    </>
  );
}
