import { useState } from 'react';
import { useApp } from '../AppContext';
import { Ph } from '../components/ui';
import { scentOf } from '../store';
import { firstInStock } from '../commerce';

const QUESTIONS = [
  { t: 'What mood are you after?', o: ['Calm', 'Cosy', 'Romantic', 'Playful', 'Grounded'] },
  { t: 'Who is it for?', o: ['Myself', 'A friend', 'A little one', 'Someone special'] },
];
const MOOD_SCENT: Record<string, string> = { Calm: 'Lavender', Cosy: 'Vanilla', Romantic: 'Jasmine', Playful: 'Strawberry', Grounded: 'Rosemary' };
const WHO_SHAPE: Record<string, number> = { Myself: 1, 'A friend': 2, 'A little one': 3, 'Someone special': 4 };

export function Finder() {
  const { products, addCandle } = useApp();
  const [ans, setAns] = useState<string[]>([]);
  const done = ans.length >= 2;
  const qi = Math.min(ans.length, 1);

  let match: { title: string; tint: string; why: string; price: number; add: () => void } | null = null;
  if (done && products.length) {
    const scent = MOOD_SCENT[ans[0]], p = products.find((x) => x.id === WHO_SHAPE[ans[1]]) ?? products[0];
    match = {
      title: p.name + ', ' + scent,
      tint: scentOf(scent).tint,
      why: scent + ' is ' + scentOf(scent).note.toLowerCase() + ', a good fit for a ' + ans[0].toLowerCase() + ' mood.',
      price: p.sizes[0].p,
      add: () => addCandle(p.id, scent, firstInStock(p), 0, 1),
    };
  }

  return (
    <section id="finder" className="band-white">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px' }}>
        <h2 className="h2">Scent Finder</h2>
        <p style={{ margin: '4px 0 24px', fontSize: 16, color: 'var(--muted)' }}>Two questions, then we will suggest a candle.</p>
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
                  <div style={{ fontSize: 16, fontWeight: 600 }}>£{match.price}</div>
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
