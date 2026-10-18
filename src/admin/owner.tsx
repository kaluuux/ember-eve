import { useEffect, useMemo, useState } from 'react';
import { EMPTY, fmtDate, money, useStored } from '../store';
import { remote } from '../remote';
import { PageHead, downloadCsv, waLink } from './ui';
import { ErrorText } from '../components/ui';
import { adjustCredit, createGiftCard, customerCredits, listActivity, listGiftCards, listStockAlerts, markAlerts, setGiftCardStatus, type ActivityRow, type GiftCardRow, type StockAlertRow } from '../sync';
import type { Product, Settings, User } from '../types';
import { DEFAULT_SETTINGS, withDefaults } from '../store';

type Flash = (m: string) => void;

/* ------------------------------------------------------------------ activity log */
const ACTION_TEXT: Record<string, string> = {
  'order.update': 'Updated order', 'order.status': 'Changed order status', 'order.pay': 'Changed payment status', 'order.cancel': 'Cancelled order',
  'catalog.update': 'Edited the catalogue', 'team.add': 'Added a team member', 'team.remove': 'Removed a team member', 'team.role': 'Changed a role',
  'review.approve': 'Published a review', 'review.update': 'Edited a review', 'review.delete': 'Deleted a review',
  'cost.update': 'Changed a cost price', 'giftcard.create': 'Created a gift card', 'credit.adjust': 'Adjusted store credit',
};
const nice = (a: string) => ACTION_TEXT[a] ?? a.replace(/[._]/g, ' ');
const brief = (d: Record<string, unknown>): string => {
  const keys = Object.keys(d || {});
  if (!keys.length) return '';
  return keys.slice(0, 4).map((k) => {
    const v = d[k];
    const t = Array.isArray(v) ? (v.length > 5 ? v.slice(0, 5).join(', ') + '…' : v.join(', ')) : typeof v === 'object' && v ? JSON.stringify(v).slice(0, 60) : String(v);
    return k + ': ' + t;
  }).join(' · ');
};

export function ActivityView() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [who, setWho] = useState('');
  useEffect(() => { void listActivity().then(setRows); }, []);
  const people = useMemo(() => [...new Set((rows ?? []).map((r) => r.actor))], [rows]);
  const shown = (rows ?? []).filter((r) => !who || r.actor === who);
  return (
    <>
      <PageHead title="Activity" sub="Who changed what, newest first. Only owners can see this." actions={<button type="button" className="btn ghost sm" onClick={() => rows && downloadCsv('activity', [['When', 'Who', 'What', 'Target', 'Detail'], ...rows.map((r) => [r.at, r.actor, nice(r.action), r.target ?? '', brief(r.detail)])])}>Export CSV</button>} />
      {!remote && <div className="panel muted">The activity log records changes on the online store. It is switched on once the shop is connected to Supabase.</div>}
      {remote && (
        <>
          <div className="filters">
            <button type="button" className={'chip' + (!who ? ' on' : '')} onClick={() => setWho('')}>Everyone</button>
            {people.map((p) => <button key={p} type="button" className={'chip' + (who === p ? ' on' : '')} onClick={() => setWho(p)}>{p}</button>)}
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {rows === null && <div className="empty">Loading…</div>}
            {rows !== null && shown.length === 0 && <div className="empty">Nothing recorded yet.</div>}
            {shown.map((r) => (
              <div key={r.id} className="act-row">
                <span className="when">{new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span><b>{r.actor}</b></span>
                <span>{nice(r.action)}{r.target ? ' · ' + r.target : ''}<div className="muted" style={{ fontSize: 12 }}>{brief(r.detail)}</div></span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------ gift cards and credit */
export function GiftCardsView({ flash }: { flash: Flash }) {
  const st = withDefaults(useStored<Settings>('settings', DEFAULT_SETTINGS));
  const users = useStored<User[]>('users', EMPTY);
  const [cards, setCards] = useState<GiftCardRow[]>([]);
  const [credits, setCredits] = useState<Record<string, { credit: number; refCode: string }>>({});
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [made, setMade] = useState('');
  const [err, setErr] = useState('');
  const [uid, setUid] = useState('');
  const [delta, setDelta] = useState('');
  const [why, setWhy] = useState('');
  const refresh = () => { void listGiftCards().then(setCards); void customerCredits().then(setCredits); };
  useEffect(refresh, []);

  const create = async () => {
    const n = Math.round(Number(amount));
    if (!(n > 0)) return setErr('Enter an amount.');
    const r = await createGiftCard(n, to.trim(), note.trim());
    if (r.error) return setErr(r.error);
    setErr(''); setMade(r.code); setAmount(''); setTo(''); setNote(''); refresh();
  };
  const adjust = async () => {
    const n = Math.round(Number(delta));
    if (!uid || !n) return setErr('Choose a customer and an amount (use a minus to take credit away).');
    const e = await adjustCredit(uid, n, why);
    if (e) return setErr(e);
    setErr(''); setDelta(''); setWhy(''); refresh(); flash('Store credit updated');
  };
  const withCredit = users.filter((u) => (credits[String(u.id)]?.credit ?? 0) > 0);
  const outstanding = cards.filter((c) => c.status === 'active').reduce((a, c) => a + c.balance, 0);
  const owed = Object.values(credits).reduce((a, c) => a + c.credit, 0);

  if (!remote) return (<><PageHead title="Gift cards and credit" /><div className="panel muted">Gift cards, store credit and referrals run on the online store. They switch on once the shop is connected to Supabase.</div></>);

  return (
    <>
      <PageHead title="Gift cards and credit" sub={money(outstanding) + ' on active gift cards · ' + money(owed) + ' of store credit held by customers'} />
      <ErrorText>{err}</ErrorText>
      {!st.giftCardsOn && <div className="notice-warn" style={{ marginBottom: 12 }}>Gift cards are not on sale yet. Turn them on in Settings, Rewards.</div>}
      <div className="dash-grid">
        <section className="panel span-6 stack" style={{ gap: 12 }}>
          <div className="h3">Create a gift card</div>
          <div className="muted" style={{ fontSize: 13 }}>For a prize, an apology or a sale you took on WhatsApp. The code is shown once here and stays in the list below.</div>
          <div className="fields two">
            <label className="field">Amount (Rs)<input className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="field">For (optional)<input className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>Private note (optional)<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div><button type="button" className="btn" onClick={create}>Create card</button></div>
          {made && <div className="notebox" style={{ background: 'var(--a-good-bg)' }}>New card: <span className="gc-code">{made}</span> <button type="button" className="btn-xs" onClick={() => { void navigator.clipboard?.writeText(made); flash('Copied'); }}>Copy</button></div>}
        </section>
        <section className="panel span-6 stack" style={{ gap: 12 }}>
          <div className="h3">Adjust store credit</div>
          <div className="muted" style={{ fontSize: 13 }}>Add or remove credit for a customer with an account. Every change is written to their statement and the activity log.</div>
          <div className="fields two">
            <label className="field" style={{ gridColumn: '1 / -1' }}>Customer
              <select className="input" value={uid} onChange={(e) => setUid(e.target.value)}>
                <option value="">Choose…</option>
                {users.map((u) => <option key={String(u.id)} value={String(u.id)}>{u.name} · {u.email}{credits[String(u.id)]?.credit ? ' · ' + money(credits[String(u.id)].credit) : ''}</option>)}
              </select>
            </label>
            <label className="field">Amount (Rs, minus to remove)<input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} /></label>
            <label className="field">Reason<input className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Shown to the customer" /></label>
          </div>
          <div><button type="button" className="btn" onClick={adjust}>Apply</button></div>
          {withCredit.length > 0 && <div className="muted" style={{ fontSize: 13 }}>Holding credit: {withCredit.map((u) => u.name + ' ' + money(credits[String(u.id)].credit)).join(' · ')}</div>}
        </section>
      </div>

      <div className="card flush" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>Code</th><th>Value</th><th>Left</th><th>For</th><th>Source</th><th>Status</th><th /></tr></thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.code}>
                <td className="gc-code">{c.code}</td>
                <td>{money(c.amount)}</td>
                <td>{money(c.balance)}</td>
                <td>{c.recipient || '-'}{c.from_name ? <div className="muted" style={{ fontSize: 12 }}>from {c.from_name}</div> : null}</td>
                <td>{c.order_id ? <a href={'/admin/orders?sel=' + c.order_id}>{c.order_id}</a> : c.note || 'Created by you'}</td>
                <td><span className="tag" style={{ background: c.status === 'active' ? 'var(--a-good-bg)' : 'var(--a-bad-bg)', color: c.status === 'active' ? 'var(--a-good)' : 'var(--a-bad)' }}>{c.status === 'active' ? (c.balance > 0 ? 'Active' : 'Used up') : 'Disabled'}</span></td>
                <td style={{ textAlign: 'right' }}><button type="button" className="btn-xs" onClick={async () => { const e = await setGiftCardStatus(c.code, c.status === 'active' ? 'disabled' : 'active'); if (e) flash(e); refresh(); }}>{c.status === 'active' ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {cards.length === 0 && <div className="empty">No gift cards yet.</div>}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- back-in-stock */
export function AlertsView({ flash }: { flash: Flash }) {
  const products = useStored<Product[]>('products', EMPTY);
  const demo = useStored<StockAlertRow[]>('alerts', EMPTY);
  const st = withDefaults(useStored<Settings>('settings', DEFAULT_SETTINGS));
  const [rows, setRows] = useState<StockAlertRow[]>([]);
  const [showDone, setShowDone] = useState(false);
  const load = () => { void listStockAlerts().then(setRows); };
  useEffect(load, [demo]);
  const pname = (id: number) => products.find((p) => p.id === id)?.name ?? 'Removed candle';
  const stockOf = (id: number) => products.find((p) => p.id === id)?.stock;

  const groups = useMemo(() => {
    const m = new Map<number, StockAlertRow[]>();
    rows.filter((r) => showDone || !r.notified).forEach((r) => m.set(r.pid, (m.get(r.pid) ?? []).concat(r)));
    return [...m.entries()].map(([pid, list]) => ({ pid, list, back: stockOf(pid) === null || (stockOf(pid) ?? 0) > 0 })).sort((a, b) => Number(b.back) - Number(a.back));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, showDone, products]);

  const done = async (ids: number[]) => { await markAlerts(ids, true); load(); flash('Marked as told'); };
  const msg = (pid: number) => 'Good news! ' + pname(pid) + ' is back in stock at ' + st.shop + '. ';

  return (
    <>
      <PageHead title="Back in stock" sub="People waiting for a sold-out candle. When you restock it, tell them with one tap, then mark them as told." actions={<button type="button" className="btn ghost sm" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide told' : 'Show told'}</button>} />
      {groups.length === 0 && <div className="panel muted">Nobody is waiting right now.</div>}
      <div className="stack" style={{ gap: 12 }}>
        {groups.map((g) => (
          <section key={g.pid} className="panel stack" style={{ gap: 8 }}>
            <div className="row-between">
              <div><b>{pname(g.pid)}</b> <span className="tag" style={g.back ? { background: 'var(--a-good-bg)', color: 'var(--a-good)' } : { background: 'var(--a-warn-bg)', color: 'var(--a-warn)' }}>{g.back ? 'Back in stock' : 'Still sold out'}</span><div className="muted" style={{ fontSize: 12 }}>{g.list.length} waiting</div></div>
              <button type="button" className="btn-xs" onClick={() => void done(g.list.filter((r) => !r.notified).map((r) => r.id))}>Mark all as told</button>
            </div>
            {g.list.map((r) => (
              <div key={r.id} className="row-between" style={{ padding: '6px 0', borderTop: '1px solid var(--a-line-soft)', gap: 8, flexWrap: 'wrap' }}>
                <span>{r.contact} <span className="muted" style={{ fontSize: 12 }}>· {fmtDate(r.created_at, { day: 'numeric', month: 'short' })}{r.notified ? ' · told' : ''}</span></span>
                <span style={{ display: 'flex', gap: 6 }}>
                  {r.kind === 'phone' ? <a className="btn-xs" href={waLink(r.contact, msg(g.pid))} target="_blank" rel="noreferrer">WhatsApp</a> : <a className="btn-xs" href={'mailto:' + r.contact + '?subject=' + encodeURIComponent(pname(g.pid) + ' is back') + '&body=' + encodeURIComponent(msg(g.pid) + (window.location.origin + '/product/' + g.pid))}>Email</a>}
                  {!r.notified && <button type="button" className="btn-xs" onClick={() => void done([r.id])}>Told</button>}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
