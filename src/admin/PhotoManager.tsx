import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uploadImage } from '../sync';
import { PhotoEditor, type CropResult, type Folder } from './PhotoEditor';

interface Job { src: File | string; n: number; of: number; done: (r: CropResult) => void }

/** Add, crop, reorder (first = cover) and remove photos. Used for products, category tiles and the home gallery. */
export function PhotoManager({ images, onChange, folder, max = 8, compact }: { images: string[]; onChange: (next: string[]) => void; folder: Folder; max?: number; compact?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [job, setJob] = useState<Job | null>(null);

  /** Open the crop editor and wait for the answer */
  const ask = (src: File | string, n: number, of: number) => new Promise<CropResult>((resolve) => setJob({ src, n, of, done: resolve }));
  const finish = (r: CropResult) => { const j = job; setJob(null); j?.done(r); };
  const asFile = (b: Blob) => new File([b], 'photo.jpg', { type: 'image/jpeg' });

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    let list = images.slice();
    const todo = Array.from(files).slice(0, Math.max(0, max - list.length || (max === 1 ? 1 : 0)));
    for (let i = 0; i < todo.length; i++) {
      // photos go in exactly as chosen; the ✎ button on a photo opens the crop and preview editor when you want it
      setBusy('Uploading ' + (i + 1) + ' of ' + todo.length + '…');
      const up = await uploadImage(todo[i], folder);
      if (up.error) { setErr(up.error); break; }
      list = max === 1 ? [up.url] : list.concat(up.url);
      onChange(list);
    }
    setBusy('');
    if (files.length > todo.length && max > 1) setErr('Up to ' + max + ' photos. The extra ones were skipped.');
  };

  /** Re-crop a photo that is already uploaded; the new crop replaces it in the same position */
  const adjust = async (i: number) => {
    setErr('');
    const r = await ask(images[i], 1, 1);
    if (r === null || r === 'original') return;
    setBusy('Saving…');
    const up = await uploadImage(asFile(r), folder);
    setBusy('');
    if (up.error) return setErr(up.error);
    onChange(images.map((u, j) => (j === i ? up.url : u)));
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
              <button type="button" aria-label="Crop and adjust photo" title="Crop and adjust" disabled={!!busy} onClick={() => void adjust(i)}>✎</button>
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
      {!compact && <div className="muted" style={{ fontSize: 12 }}>The first photo is the cover. Photos are added exactly as you choose them. Click ✎ on a photo to crop it and preview how it looks on desktop and mobile.</div>}
      {/* portal: the product dialog is CSS-transformed, which would trap a fixed-position editor inside it */}
      {job && createPortal(<PhotoEditor src={job.src} folder={folder} n={job.n} of={job.of} onClose={finish} />, document.body)}
    </div>
  );
}
