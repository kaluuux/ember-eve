import { useState } from 'react';
import { useApp } from '../AppContext';
import { Ph } from '../components/ui';
import { colorOf, money } from '../store';
import { defaultSelection, lowestPrice, normalize } from '../commerce';

const QUESTIONS = [
  { t: 'What mood are you after?', o: ['Calm', 'Cosy', 'Romantic', 'Playful', 'Grounded'] },
  { t: 'Who is it for?', o: ['Myself', 'A friend', 'A little one', 'Someone special'] },
];
const MOOD_COLOR: Record<string, string> = { Calm: 'lavender', Cosy: 'ivory', Romantic: 'rose', Playful: 'coral', Grounded: 'sage' };
const MOOD_NOTE: Record<string, string> = { Calm: 'soft and quiet', Cosy: 'warm and gentle', Romantic: 'deep and tender', Playful: 'bright and cheerful', Grounded: 'natural and fresh' };
/** Which category suits the recipient; falls back to the first category the shop has. */
const WHO_CAT: Record<string, string> = { Myself: 'jar', 'A friend': 'glass', 'A little one': 'mold', 'Someone special': 'glass' };

export function Finder() {
  const { active, addCandle, colors } = useApp();
  const [ans, setAns] = useState<string[]>([]);
  const done = ans.length >= 2;
  const qi = Math.min(ans.length, 1);

  let match: { title: string; tint: string; why: string; price: number; add: () => void } | null = null;
  if (done && active.length) {
    const col = colorOf(colors, MOOD_COLOR[ans[0]]);
    const p = active.find((x) => x.cat === WHO_CAT[ans[1]]) ?? active[0];
    match = {
      title: p.name + ', ' + col.name,
      tint: col.hex,
      why: col.name + ' is ' + MOOD_NOTE[ans[0]] + ', a good fit for a ' + ans[0].toLowerCase() + ' mood.',
      price: lowestPrice(p),
      add: () => addCandle(p.id, normalize(p, { ...defaultSelection(p, colors), color: p.colors ? col.id : '' }, colors)),
    };
  }

  return (
    <section id="finder" className="band-white">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px' }}>
        <h2 className="h2">Colour Finder</h2>
        <p style={{ margin: '4px 0 24px', fontSize: 16, color: 'var(--muted)' }}>Two questions, then we will suggest a candle and a colour.</p>
        <div className="card" style={{ background: 'var(--bg)' }}>
          {!done && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)' }}>Question {qi + 1} of 2</div>
              <div style={{ height: 4, borderRadius: 9999, background: 'var(--sand-l)', margin: '8px 0 16px' }}><div style={{ height: 4, borderRadius: 9999, background: 'var(--brown)', width: (qi / 2) * 100 + '%' }} /></div>
              <div style={{ fontSize: 22, lineHeight: '30px', fontWeight: 700, marginBottom: 16 }}>{QUESTIONS[qi].t}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                {QUESTIONS[qi].o.map((o) => (
                  <button key={o} type="button" className="answer" onClick={() => setAns((a) => a.concat(o))}>{o}</button>
                ))}
              </div>
            </>
          )}
          {match && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Your match</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginTop: 12, alignItems: 'center' }}>
                <Ph tint={match.tint} label={match.title} ratio="1" />
                <div className="stack" style={{ gap: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{match.title}</div>
                  <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--muted)' }}>{match.why}</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>from {money(match.price)}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn sm" onClick={match.add}>Add to Basket</button>
                    <button type="button" className="btn sm ghost" onClick={() => setAns([])}>Retake</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
