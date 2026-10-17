import { useRef, useState } from 'react';
import { uploadImage } from '../sync';

/** Add, reorder (first = cover) and remove photos. Used for products, category tiles and the home gallery. */
export function PhotoManager({ images, onChange, folder, max = 8, compact }: { images: string[]; onChange: (next: string[]) => void; folder: 'products' | 'categories' | 'gallery'; max?: number; compact?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    let list = images.slice();
    const todo = Array.from(files).slice(0, Math.max(0, max - list.length));
    for (let i = 0; i < todo.length; i++) {
      setBusy('Uploading ' + (i + 1) + ' of ' + todo.length + '…');
      const r = await uploadImage(todo[i], folder);
      if (r.error) { setErr(r.error); break; }
      list = max === 1 ? [r.url] : list.concat(r.url);
      onChange(list);
    }
    setBusy('');
    if (files.length > todo.length && max > 1) setErr('Up to ' + max + ' photos. The extra ones were skipped.');
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = images.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className={'photos' + (compact ? ' compact' : '')}>
      <div className="photo-grid">
        {images.map((u, i) => (
          <div key={u + i} className="photo">
            <img src={u} alt={'Photo ' + (i + 1)} />
            {i === 0 && max > 1 && <span className="cover">Cover</span>}
            <div className="photo-actions">
              {max > 1 && <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>‹</button>}
              {max > 1 && <button type="button" aria-label="Move later" disabled={i === images.length - 1} onClick={() => move(i, 1)}>›</button>}
              <button type="button" aria-label="Remove photo" onClick={() => onChange(images.filter((_, j) => j !== i))}>✕</button>
            </div>
          </div>
        ))}
        {(images.length < max || max === 1) && (
          <button type="button" className="photo add" disabled={!!busy} onClick={() => file.current?.click()}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
            <span>{busy || (max === 1 ? (images.length ? 'Replace' : 'Add photo') : 'Add photos')}</span>
          </button>
        )}
      </div>
      <input ref={file} type="file" accept="image/*" multiple={max > 1} hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      {err && <div className="err" role="alert">{err}</div>}
      {!compact && <div className="muted" style={{ fontSize: 12 }}>The first photo is the cover. Photos are resized automatically. Use bright, square-ish photos for the best look.</div>}
    </div>
  );
}
