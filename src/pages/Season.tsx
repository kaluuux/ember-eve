import { useApp } from '../AppContext';
import { ProductCard } from '../components/ProductCard';
import { Countdown } from '../components/Countdown';
import { seasonTiming } from '../commerce';
import { NotFound } from './Info';
import { useHydrated } from '../sync';
import type { Route } from '../router';

/** A landing page for one seasonal collection (/season/<id>): story, countdown to opening or closing, and its candles. */
export function Season({ route }: { route: Route }) {
  const { seasons, products } = useApp();
  const hydrated = useHydrated();
  const se = seasons.find((s) => s.id === route.arg);
  if (!se) return hydrated ? <NotFound /> : <section className="page" style={{ minHeight: '60vh' }} aria-busy="true" />;
  const list = products.filter((p) => p.active && p.season === se.id);
  const tm = seasonTiming(se);
  const others = seasons.filter((s) => s.id !== se.id && products.some((p) => p.active && p.season === s.id));
  const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return (
    <>
      <section className="season-hero">
        <div className="page-72" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Seasonal collection</span>
          <h1 className="h1" style={{ margin: '8px 0 12px' }}>{se.name}</h1>
          {se.blurb && <p className="lede" style={{ margin: '0 auto 20px', maxWidth: 620 }}>{se.blurb}</p>}
          {tm.at ? (
            <>
              <div className="muted" style={{ marginBottom: 10, fontWeight: 600 }}>
                {tm.state === 'live' ? 'On now. Ends ' + date(tm.at) : 'Opens ' + date(tm.at)}
              </div>
              <Countdown to={tm.at} />
            </>
          ) : (
            <div className="muted" style={{ fontWeight: 600 }}>{tm.state === 'live' ? 'On now' : 'Not available right now'}</div>
          )}
          <div style={{ marginTop: 20 }}><a href="#candles" className="btn">{tm.state === 'live' ? 'Shop the collection' : 'See the collection'}</a></div>
        </div>
      </section>

      <section className="page" id="candles">
        <div className="crumb"><a href="/">Home</a> / <a href="/shop?seasonal=1">Seasonal</a> / {se.name}</div>
        <h2 className="h2" style={{ margin: '8px 0 16px' }}>{se.name} candles <span className="muted" style={{ fontWeight: 400, fontSize: 16 }}>({list.length})</span></h2>
        {list.length === 0 && <div className="card" style={{ textAlign: 'center' }}><p className="muted" style={{ margin: 0 }}>Candles for this collection are on their way. Check back soon.</p></div>}
        <div className="pgrid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        {others.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 className="h3" style={{ marginBottom: 10 }}>More collections</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{others.map((s) => <a key={s.id} href={'/season/' + s.id} className="btn ghost">{s.name}</a>)}</div>
          </div>
        )}
      </section>
    </>
  );
}
