import { useEffect, useRef, useState } from 'react';

export type Folder = 'products' | 'categories' | 'gallery';
/** A place the photo appears on the site. Ratios are width / height, copied from the storefront CSS. */
interface Frame { label: string; desktop: number; mobile: number }

const SPEC: Record<Folder, { ratio: number; frames: Frame[]; note: string }> = {
  // card: square on desktop, 1 / 1.02 on phones · product page gallery: square on desktop, 1 / 0.86 on phones
  products: {
    ratio: 1,
    frames: [{ label: 'Shop card', desktop: 1, mobile: 1 / 1.02 }, { label: 'Product page', desktop: 1, mobile: 1 / 0.86 }],
    note: 'Photos are cropped square. On phones the product page is a little wider than tall, so keep the candle inside the dashed box.',
  },
  categories: { ratio: 4 / 3, frames: [{ label: 'Home tile', desktop: 4 / 3, mobile: 4 / 3 }], note: 'Home page tiles are 4:3.' },
  gallery: { ratio: 4 / 5, frames: [{ label: 'Home gallery', desktop: 4 / 5, mobile: 4 / 5 }], note: 'Home gallery photos are 4:5 (portrait).' },
};

export type CropResult = Blob | 'original' | null;

/* ------------------------------------------------------------------ geometry */
interface Centre { x: number; y: number }

/** Keep the frame on the photo; when the frame is bigger than the photo along an axis, centre the photo in it. */
const place = (v: number, size: number, region: number) => (region >= size ? (size - region) / 2 : Math.min(Math.max(v, 0), size - region));

function geom(img: HTMLImageElement, rot: number, A: number, zoom: number, c: Centre) {
  const odd = rot % 2 === 1;
  const sw = odd ? img.naturalHeight : img.naturalWidth, sh = odd ? img.naturalWidth : img.naturalHeight;
  // zoom 1 shows the whole photo (the frame is as big as the photo needs, with white around it if the shapes differ); zooming in crops closer
  let rw: number, rh: number;
  if (sw / sh > A) { rw = sw; rh = sw / A; } else { rh = sh; rw = sh * A; }
  rw /= zoom; rh /= zoom;
  const x0 = place(c.x * sw - rw / 2, sw, rw), y0 = place(c.y * sh - rh / 2, sh, rh);
  return { sw, sh, rw, rh, x0, y0 };
}

/** Draw the visible region of the (rotated) photo into a canvas of the crop's shape. */
function paint(canvas: HTMLCanvasElement, img: HTMLImageElement, rot: number, A: number, zoom: number, c: Centre, outW: number) {
  const g = geom(img, rot, A, zoom, c);
  canvas.width = outW; canvas.height = Math.round(outW / A);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(outW / g.rw, outW / g.rw);
  ctx.translate(-g.x0, -g.y0);
  if (rot === 1) { ctx.translate(g.sw, 0); ctx.rotate(Math.PI / 2); }
  else if (rot === 2) { ctx.translate(g.sw, g.sh); ctx.rotate(Math.PI); }
  else if (rot === 3) { ctx.translate(0, g.sh); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  return g;
}

/* -------------------------------------------------------------------- editor */
export function PhotoEditor({ src, folder, n, of, onClose }: { src: File | string; folder: Folder; n: number; of: number; onClose: (r: CropResult) => void }) {
  const { ratio: A, frames, note } = SPEC[folder];
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [c, setC] = useState<Centre>({ x: 0.5, y: 0.5 });
  const [guide, setGuide] = useState(true);
  const [prev, setPrev] = useState('');
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

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

  // repaint the crop area and the small previews whenever anything changes
  useEffect(() => {
    if (!img || !stage.current) return;
    paint(stage.current, img, rot, A, zoom, c, 720);
    const raf = requestAnimationFrame(() => {
      const t = document.createElement('canvas');
      paint(t, img, rot, A, zoom, c, 420);
      setPrev(t.toDataURL('image/jpeg', 0.82));
    });
    return () => cancelAnimationFrame(raf);
  }, [img, rot, zoom, c, A]);

  // the part of the crop that every frame (desktop and phone) always shows
  let vFrac = 1, hFrac = 1;
  frames.forEach((f) => [f.desktop, f.mobile].forEach((r) => { if (r > A) vFrac = Math.min(vFrac, A / r); else if (r < A) hFrac = Math.min(hFrac, r / A); }));
  const showGuide = guide && (vFrac < 0.995 || hFrac < 0.995);

  const move = (dx: number, dy: number) => {
    if (!img) return;
    const g = geom(img, rot, A, zoom, c);
    const x0 = place(g.x0 + dx, g.sw, g.rw), y0 = place(g.y0 + dy, g.sh, g.rh);
    setC({ x: (x0 + g.rw / 2) / g.sw, y: (y0 + g.rh / 2) / g.sh });
  };
  const onDown = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !img || !stage.current) return;
    const rect = stage.current.getBoundingClientRect(), g = geom(img, rot, A, zoom, c);
    move(-((e.clientX - d.cx) / rect.width) * g.rw, -((e.clientY - d.cy) / rect.height) * g.rh);
    d.cx = e.clientX; d.cy = e.clientY;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!img) return;
    const g = geom(img, rot, A, zoom, c), s = 0.04;
    const m: Record<string, [number, number]> = { ArrowLeft: [-s * g.rw, 0], ArrowRight: [s * g.rw, 0], ArrowUp: [0, -s * g.rh], ArrowDown: [0, s * g.rh] };
    if (m[e.key]) { e.preventDefault(); move(...m[e.key]); }
  };
  const turn = (d: number) => { setRot((r) => (r + d + 4) % 4); setC({ x: 0.5, y: 0.5 }); };
  const reset = () => { setRot(0); setZoom(1); setC({ x: 0.5, y: 0.5 }); };

  const apply = async () => {
    if (!img) return;
    setBusy(true);
    const t = document.createElement('canvas');
    const g = geom(img, rot, A, zoom, c);
    paint(t, img, rot, A, zoom, c, Math.min(1400, Math.max(300, Math.round(g.rw))));
    const blob = await new Promise<Blob | null>((res) => t.toBlob(res, 'image/jpeg', 0.9));
    setBusy(false);
    onClose(blob ?? 'original');
  };

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
              <div className="pe-stagewrap" style={{ width: `min(360px, 100%, calc(46vh * ${A}))`, aspectRatio: String(A) }}>
                <canvas
                  ref={stage} className="pe-stage" tabIndex={0}
                  aria-label="Photo crop area. Drag the photo, or use the arrow keys, to move it."
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={onKey}
                />
                {showGuide && <div className="pe-guide" style={{ width: hFrac * 100 + '%', height: vFrac * 100 + '%' }}><span>Always visible</span></div>}
              </div>
              <div className="pe-controls">
                <label className="pe-zoom">Zoom (1× shows the whole photo)
                  <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
                </label>
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
