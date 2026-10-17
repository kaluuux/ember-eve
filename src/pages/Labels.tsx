import { useEffect } from 'react';
import { useApp } from '../AppContext';
import { EMPTY, get, useStored } from '../store';
import { remote } from '../remote';
import { useIsAdmin } from '../sync';
import type { Route } from '../router';
import type { Order } from '../types';

/** Print-ready courier labels (and a pick list) for the orders named in ?ids=EE-1001,EE-1002. Admin only. */
export function Labels({ route }: { route: Route }) {
  const { settings: st } = useApp();
  const orders = useStored<Order[]>('orders', EMPTY);
  const admin = useIsAdmin() || (!remote && !!get('admin', null));
  const ids = (route.q.ids || '').split(',').map((x) => x.trim()).filter(Boolean);
  const list = ids.map((id) => orders.find((o) => o.id === id)).filter((o): o is Order => !!o && o.shipM !== 'pickup' && o.shipM !== 'digital');

  useEffect(() => { document.title = 'Labels · ' + st.shop; }, [st.shop]);

  if (!admin) return <div className="lbl-wrap"><p>Sign in to the admin to print labels.</p><a href="/admin">Admin sign in</a></div>;

  // what to pick off the shelf for all these orders together
  const pick = new Map<string, number>();
  list.forEach((o) => o.items.forEach((i) => {
    if (i.box?.length) i.box.forEach((c) => pick.set(c.name || 'Candle', (pick.get(c.name || 'Candle') ?? 0) + i.qty));
    else if (i.kind !== 'giftcard') pick.set(i.name, (pick.get(i.name) ?? 0) + i.qty);
  }));

  return (
    <div className="lbl-wrap">
      <style>{LABEL_CSS}</style>
      <div className="lbl-bar no-print">
        <div><b>{list.length}</b> courier {list.length === 1 ? 'label' : 'labels'}</div>
        <button type="button" className="btn sm" onClick={() => window.print()}>Print</button>
        <a href="/admin/orders" className="btn sm ghost">Back to orders</a>
      </div>
      {list.length === 0 && <p className="no-print">None of the selected orders needs a courier label (pickup and gift card orders are skipped).</p>}

      {list.length > 1 && (
        <section className="lbl-pick">
          <h2>Pick list</h2>
          <table>
            <tbody>{[...pick.entries()].sort((a, b) => b[1] - a[1]).map(([n, q]) => <tr key={n}><td>{q} ×</td><td>{n}</td></tr>)}</tbody>
          </table>
          <div className="lbl-small">For orders {list.map((o) => o.id).join(', ')}</div>
        </section>
      )}

      <div className="lbl-sheet">
        {list.map((o) => (
          <article key={o.id} className="lbl">
            <div className="lbl-from">
              <b>{st.shop}</b>
              {st.businessAddress && <span>{st.businessAddress}</span>}
              {st.businessPhone && <span>{st.businessPhone}</span>}
            </div>
            <div className="lbl-to">
              <div className="lbl-small">DELIVER TO</div>
              <div className="lbl-name">{o.name}</div>
              <div>{o.address.a1}</div>
              {o.address.a2 && <div>{o.address.a2}</div>}
              <div>{o.address.city}{o.address.post ? ' ' + o.address.post : ''}</div>
              {o.address.district && <div>{o.address.district} District</div>}
              <div className="lbl-phone">{o.phone}</div>
            </div>
            <div className="lbl-foot">
              <span><b>{o.id}</b> · {o.shipM === 'express' ? 'EXPRESS' : 'Standard'}</span>
              <span>{o.items.reduce((a, i) => a + i.qty, 0)} {o.items.reduce((a, i) => a + i.qty, 0) === 1 ? 'item' : 'items'} · Fragile, candles</span>
              {o.tracking?.number && <span>{o.tracking.courier} {o.tracking.number}</span>}
            </div>
            {o.note && <div className="lbl-note">Gift message inside</div>}
          </article>
        ))}
      </div>
    </div>
  );
}

const LABEL_CSS = `
.lbl-wrap{font:14px/1.35 Inter,system-ui,sans-serif;color:#1c1c1c;background:#fff;min-height:100vh;padding:20px}
.lbl-bar{display:flex;gap:12px;align-items:center;margin-bottom:16px}
.lbl-pick{border:1px dashed #999;border-radius:6px;padding:12px 16px;margin-bottom:16px;max-width:420px;break-inside:avoid}
.lbl-pick h2{margin:0 0 6px;font-size:16px}
.lbl-pick table{border-collapse:collapse}
.lbl-pick td{padding:2px 10px 2px 0}
.lbl-sheet{display:grid;grid-template-columns:repeat(2,99mm);gap:0;justify-content:start}
.lbl{box-sizing:border-box;width:99mm;height:67mm;border:1px dashed #999;padding:5mm;display:flex;flex-direction:column;gap:3mm;position:relative;break-inside:avoid;overflow:hidden}
.lbl-from{display:flex;flex-direction:column;font-size:10px;color:#444;line-height:1.25}
.lbl-from b{font-size:11px;color:#111}
.lbl-to{flex:1;font-size:13px}
.lbl-name{font-size:17px;font-weight:700;margin:1px 0 2px}
.lbl-phone{font-weight:700;margin-top:3px;font-size:14px}
.lbl-small{font-size:9px;letter-spacing:.08em;color:#666}
.lbl-foot{display:flex;flex-direction:column;font-size:10px;color:#333;border-top:1px solid #ccc;padding-top:2mm}
.lbl-note{position:absolute;right:5mm;top:5mm;font-size:9px;border:1px solid #333;border-radius:3px;padding:1px 5px}
@page{size:A4;margin:8mm}
@media print{.no-print{display:none!important}.lbl-wrap{padding:0}.lbl{border-color:#bbb}}
`;
