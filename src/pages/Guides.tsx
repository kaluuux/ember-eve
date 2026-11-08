import { GUIDES, guideBySlug } from '../guides-data.js';
import { NotFound } from './Info';
import type { Route } from '../router';

const body = { fontSize: 16, lineHeight: '26px', color: 'var(--text2)', margin: '0 0 12px' } as const;

/** Buying guides: /guides lists them, /guides/<slug> is one article. The text lives in guides-data.js so search engines get the same copy. */
export function Guides({ route }: { route: Route }) {
  if (!route.arg) {
    return (
      <section className="page">
        <div className="crumb"><a href="/">Home</a> / Guides</div>
        <h1 className="h1" style={{ margin: '8px 0 8px' }}>Candle guides</h1>
        <p className="muted" style={{ margin: '0 0 24px', maxWidth: 640 }}>Soy wax candles in Sri Lanka: how to choose, what to gift and how to care for them, from the makers at Ember &amp; Eve.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {GUIDES.map((g) => (
            <a key={g.slug} href={'/guides/' + g.slug} className="card stack" style={{ gap: 8, textDecoration: 'none', color: 'inherit' }}>
              <div className="h3">{g.title}</div>
              <div className="muted" style={{ fontSize: 14, lineHeight: '22px' }}>{g.description}</div>
              <span style={{ color: 'var(--brown)', fontWeight: 600, fontSize: 14 }}>Read the guide →</span>
            </a>
          ))}
        </div>
      </section>
    );
  }
  const g = guideBySlug(route.arg);
  if (!g) return <NotFound />;
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  return (
    <article className="page" style={{ maxWidth: 780 }}>
      <div className="crumb"><a href="/">Home</a> / <a href="/guides">Guides</a> / {g.title}</div>
      <h1 className="h1" style={{ margin: '8px 0 16px' }}>{g.title}</h1>
      <p style={{ ...body, fontSize: 18, lineHeight: '28px' }}>{g.intro}</p>
      {g.sections.map((s) => (
        <section key={s.h} style={{ marginTop: 28 }}>
          <h2 className="h2" style={{ marginBottom: 10 }}>{s.h}</h2>
          {s.p.map((t) => <p key={t} style={body}>{t}</p>)}
        </section>
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '32px 0' }}>
        {g.links.map(([label, href], i) => <a key={href} href={href} className={i === 0 ? 'btn' : 'btn ghost'}>{label}</a>)}
      </div>
      {g.faq.length > 0 && (
        <section>
          <h2 className="h2" style={{ marginBottom: 10 }}>Frequently asked questions</h2>
          {g.faq.map((f) => (
            <div key={f.q} style={{ marginBottom: 14 }}>
              <h3 style={{ font: '600 16px Inter', margin: '0 0 4px' }}>{f.q}</h3>
              <p style={{ ...body, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </section>
      )}
      <section style={{ marginTop: 32 }}>
        <h2 className="h3" style={{ marginBottom: 8 }}>More guides</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: '28px' }}>
          {others.map((o) => <li key={o.slug}><a href={'/guides/' + o.slug}>{o.title}</a></li>)}
        </ul>
      </section>
    </article>
  );
}
