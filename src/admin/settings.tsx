import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SL_DISTRICTS, get, set, useStored, DEFAULT_SETTINGS, withDefaults } from '../store';
import { remote } from '../remote';
import { addAdmin, adminEmail, exportAll, getNotify, listAdmins, removeAdmin, sendTestAlert, setNotify, uploadQr, useIsAdmin } from '../sync';
import { ErrorText } from '../components/ui';
import { PageHead } from './ui';
import type { BankAccount, GiftBox, Settings } from '../types';

type Flash = (m: string) => void;

const Section = ({ title, hint, children, onSave, saved }: { title: string; hint?: string; children: ReactNode; onSave?: () => void; saved?: string }) => (
  <section className="panel stack" style={{ gap: 16 }}>
    <div>
      <div className="h3">{title}</div>
      {hint && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{hint}</div>}
    </div>
    {children}
    {onSave && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={onSave}>Save</button>
        {saved && <span className="ok" role="status">{saved}</span>}
      </div>
    )}
  </section>
);

const Label = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) => (
  <label className="field" style={wide ? { gridColumn: '1 / -1' } : undefined}>{label}{children}</label>
);

/* ------------------------------------------------------------------- Settings */
export function SettingsView({ flash }: { flash: Flash }) {
  const stored = withDefaults(useStored<Settings>('settings', DEFAULT_SETTINGS));
  const [d, setD] = useState<Settings>(stored);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const up = (o: Partial<Settings>) => { setD((t) => ({ ...t, ...o })); setSaved(''); };
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  // pick up changes that arrive from the server while this page is open
  useEffect(() => { setD(stored); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(stored)]);

  const save = (section: string) => {
    if (d.pay.bank && !d.banks.some((b) => b.number.trim())) return setErr('Add a bank account number, or turn bank transfer off.');
    if (d.whatsapp && !/^\d{9,15}$/.test(d.whatsapp)) return setErr('WhatsApp number: digits only with country code, for example 94771234567.');
    setErr('');
    set('settings', { ...withDefaults(get<Settings>('settings', DEFAULT_SETTINGS)), ...d });
    setSaved('Saved'); setTimeout(() => setSaved(''), 2500);
    void section;
  };

  const setBank = (i: number, o: Partial<BankAccount>) => up({ banks: d.banks.map((x, j) => (j === i ? { ...x, ...o } : x)) });
  const setBox = (i: number, o: Partial<GiftBox>) => up({ giftBoxes: d.giftBoxes.map((b, j) => (j === i ? { ...b, ...o } : b)) });

  return (
    <>
      <PageHead title="Settings" sub="Delivery, payments and how the shop runs. Changes apply to customers straight away." />
      <div className="stack" style={{ gap: 20, maxWidth: 860 }}>
        <ErrorText>{err}</ErrorText>

        <Section title="Store details" onSave={() => save('store')} saved={saved}>
          <div className="fields two">
            <Label label="Shop name"><input className="input" value={d.shop} onChange={(e) => up({ shop: e.target.value })} /></Label>
            <Label label="Contact email"><input className="input" type="email" value={d.email} onChange={(e) => up({ email: e.target.value })} /></Label>
            <Label label="WhatsApp number for orders (digits, with country code)"><input className="input" inputMode="numeric" placeholder="94771234567" value={d.whatsapp} onChange={(e) => up({ whatsapp: e.target.value.replace(/\D/g, '') })} /></Label>
            <Label label="Store pickup address (leave empty to turn pickup off)"><input className="input" value={d.pickupAddress} onChange={(e) => up({ pickupAddress: e.target.value })} /></Label>
          </div>
        </Section>

        <Section title="Delivery" hint="Customers in a district with its own rate pay that rate; all others pay the standard rate." onSave={() => save('delivery')} saved={saved}>
          <div className="fields two">
            <Label label="Standard delivery (Rs)"><input className="input" type="number" min={0} value={d.standard} onChange={(e) => up({ standard: num(e.target.value) })} /></Label>
            <Label label="Express delivery (Rs)"><input className="input" type="number" min={0} value={d.express} onChange={(e) => up({ express: num(e.target.value) })} /></Label>
            <Label label="Free standard delivery over (Rs)"><input className="input" type="number" min={0} value={d.freeOver} onChange={(e) => up({ freeOver: num(e.target.value) })} /></Label>
            <Label label="Gift wrap (Rs)"><input className="input" type="number" min={0} value={d.giftWrap} onChange={(e) => up({ giftWrap: num(e.target.value) })} /></Label>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Rate by district ({d.districts.length} set)</summary>
            <div className="district-grid">
              {SL_DISTRICTS.map((n) => {
                const cur = d.districts.find((x) => x.name === n)?.rate;
                return (
                  <label key={n} className="field" style={{ fontSize: 12 }}>
                    {n}
                    <input className="input" type="number" min={0} placeholder={String(d.standard)} value={cur ?? ''} onChange={(e) => {
                      const rest = d.districts.filter((x) => x.name !== n);
                      up({ districts: e.target.value === '' ? rest : rest.concat({ name: n, rate: num(e.target.value) }) });
                    }} />
                  </label>
                );
              })}
            </div>
          </details>
        </Section>

        <Section title="Payments" hint="Customers choose from the methods you turn on. Card payments will be added later." onSave={() => save('pay')} saved={saved}>
          <div className="stack" style={{ gap: 10 }}>
            <Toggle on={d.pay.bank} onChange={(v) => up({ pay: { ...d.pay, bank: v } })} title="Bank transfer" sub="Customer pays into your account, then uploads the receipt or sends it on WhatsApp. You approve the payment." />
            <Toggle on={d.pay.store} onChange={(v) => up({ pay: { ...d.pay, store: v } })} title="Pay at store pickup" sub="Only offered when the customer chooses store pickup." />
            <Toggle on={d.pay.whatsapp} onChange={(v) => up({ pay: { ...d.pay, whatsapp: v } })} title="Arrange payment on WhatsApp" sub="No payment details shown; you confirm payment with the customer yourself." />
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {d.banks.map((b, i) => <BankEditor key={b.id} b={b} n={i + 1} onChange={(o) => setBank(i, o)} onRemove={() => up({ banks: d.banks.filter((_, j) => j !== i) })} flash={flash} />)}
            <div><button type="button" className="btn-xs" onClick={() => up({ banks: d.banks.concat({ id: 'bk' + Math.random().toString(36).slice(2, 7), bank: '', branch: '', name: '', number: '', qr: '' }) })}>Add bank account</button></div>
            <div className="muted" style={{ fontSize: 13 }}>Customers choose their bank, then see its LankaQR code and account details. Upload the QR image from your bank app (a screenshot works). Click Save when you are done.</div>
          </div>
        </Section>

        <Section title="Custom colours and gift boxes" hint="Gift boxes: add fixed sizes below, or leave the list empty to let customers pick any 2 to 8 candles for the single box fee." onSave={() => save('gift')} saved={saved}>
          <div className="fields two">
            <Label label="Free colours in a custom blend"><input className="input" type="number" min={0} value={d.freeColors} onChange={(e) => up({ freeColors: num(e.target.value) })} /></Label>
            <Label label="Fee per extra colour (Rs)"><input className="input" type="number" min={0} value={d.extraColorFee} onChange={(e) => up({ extraColorFee: num(e.target.value) })} /></Label>
            <Label label="Single gift box fee (Rs)"><input className="input" type="number" min={0} value={d.giftBoxFee} onChange={(e) => up({ giftBoxFee: num(e.target.value) })} /></Label>
          </div>
          {d.giftBoxes.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="input" style={{ flex: '2 1 180px' }} aria-label="Box name" placeholder="Box name, e.g. Medium box" value={b.label} onChange={(e) => setBox(i, { label: e.target.value })} />
              <input className="input" style={{ width: 100 }} type="number" min={2} max={12} aria-label="Candles" placeholder="Candles" value={b.slots} onChange={(e) => setBox(i, { slots: Math.min(12, Math.max(2, num(e.target.value))) })} />
              <input className="input" style={{ width: 120 }} type="number" min={0} aria-label="Box fee" placeholder="Fee (Rs)" value={b.fee} onChange={(e) => setBox(i, { fee: num(e.target.value) })} />
              <button type="button" className="btn-xs danger" onClick={() => up({ giftBoxes: d.giftBoxes.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <div><button type="button" className="btn-xs" onClick={() => up({ giftBoxes: d.giftBoxes.concat({ id: 'b' + Math.random().toString(36).slice(2, 7), label: '', slots: 3, fee: d.giftBoxFee }) })}>Add box size</button></div>
        </Section>

        {remote ? <><PhoneAlerts flash={flash} /><TeamAndBackup flash={flash} /></> : <LocalPassword />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------ bank account + QR */
function BankEditor({ b, n, onChange, onRemove, flash }: { b: BankAccount; n: number; onChange: (o: Partial<BankAccount>) => void; onRemove: () => void; flash: Flash }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const r = await uploadQr(f);
    setBusy(false);
    if (r.error) return flash(r.error);
    onChange({ qr: r.url });
    flash('QR uploaded. Click Save to publish it.');
  };
  return (
    <div className="card" style={{ background: 'var(--a-bg)', padding: 16 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <b>Bank account {n}{b.bank ? ' · ' + b.bank : ''}</b>
        <button type="button" className="btn-xs danger" onClick={onRemove}>Remove</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px', gap: 16, alignItems: 'start' }}>
        <div className="fields two">
          <Label label="Bank"><input className="input" placeholder="e.g. Commercial Bank" value={b.bank} onChange={(e) => onChange({ bank: e.target.value })} /></Label>
          <Label label="Branch"><input className="input" value={b.branch} onChange={(e) => onChange({ branch: e.target.value })} /></Label>
          <Label label="Account name"><input className="input" value={b.name} onChange={(e) => onChange({ name: e.target.value })} /></Label>
          <Label label="Account number"><input className="input" value={b.number} onChange={(e) => onChange({ number: e.target.value })} /></Label>
        </div>
        <div className="stack" style={{ gap: 8, alignItems: 'stretch' }}>
          <div className="label-s" style={{ margin: 0 }}>LankaQR code</div>
          {b.qr ? <img src={b.qr} alt={'QR for ' + (b.bank || 'bank')} style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', background: '#fff', border: '1px solid var(--a-line)', borderRadius: 10 }} />
            : <div className="muted" style={{ aspectRatio: '1', border: '1px dashed #CFC6BA', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 12, padding: 8 }}>No QR yet</div>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-xs" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Uploading…' : b.qr ? 'Replace QR' : 'Upload QR'}</button>
          {b.qr && <button type="button" className="btn-xs danger" onClick={() => onChange({ qr: '' })}>Remove QR</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- phone alerts */
const newTopic = () => {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return 'ember-eve-' + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
};

function PhoneAlerts({ flash }: { flash: Flash }) {
  const isAdmin = useIsAdmin();
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isAdmin) void getNotify().then((n) => setTopic(n?.topic ?? '')); }, [isAdmin]);

  const enable = async () => {
    setBusy(true);
    const t = newTopic();
    const e = await setNotify(t);
    setBusy(false);
    if (e) return flash(e);
    setTopic(t); flash('Phone alerts are on');
  };
  const off = async () => { const e = await setNotify(''); if (e) return flash(e); setTopic(''); flash('Phone alerts are off'); };
  const test = async () => { const e = await sendTestAlert(); flash(e || 'Test alert sent. Check your phone.'); };

  return (
    <Section title="Phone alerts" hint="Get an instant notification on your phone for every new order and every uploaded receipt. Free, using the ntfy app.">
      {topic === null ? <div className="muted">Loading…</div> : topic === '' ? (
        <div><button type="button" className="btn" disabled={busy} onClick={enable}>{busy ? 'Setting up…' : 'Turn on phone alerts'}</button></div>
      ) : (
        <>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            <li>Install the free <b>ntfy</b> app on your phone (Google Play, App Store or F-Droid).</li>
            <li>Open it, tap <b>+</b> (Subscribe to topic), and enter this private topic name exactly:</li>
          </ol>
          <div className="bank-box" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <code style={{ fontSize: 15, wordBreak: 'break-all' }}>{topic}</code>
            <button type="button" className="btn-xs" onClick={() => { void navigator.clipboard?.writeText(topic); flash('Copied'); }}>Copy</button>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>Keep the topic name private: anyone who knows it could read your alerts. Leave the server as ntfy.sh. Allow notifications when your phone asks.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={test}>Send a test alert</button>
            <button type="button" className="btn ghost danger" onClick={off}>Turn off</button>
            <button type="button" className="btn-xs" onClick={enable}>Create a new topic</button>
          </div>
        </>
      )}
    </Section>
  );
}

/* -------------------------------------------------------- admin team and backup */
function TeamAndBackup({ flash }: { flash: Flash }) {
  const isAdmin = useIsAdmin();
  const [admins, setAdmins] = useState<string[]>([]);
  const [me, setMe] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const refresh = () => { void listAdmins().then(setAdmins); };
  useEffect(() => { if (isAdmin) { refresh(); void adminEmail().then((e) => setMe(e.toLowerCase())); } }, [isAdmin]);

  const add = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
    const e = await addAdmin(email);
    if (e) return setErr(e);
    setErr(''); setEmail(''); refresh(); flash('Admin added');
  };
  const remove = async (a: string) => {
    const e = await removeAdmin(a);
    if (e) return flash(e);
    refresh(); flash('Admin removed');
  };
  const backup = async () => {
    flash('Preparing backup…');
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'ember-eve-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(url);
    flash('Backup downloaded');
  };

  return (
    <>
      <Section title="Admin team" hint="Each admin signs in with their own email and password. To add someone, they first create an account on the store (Sign Up), then you add their email here.">
        <div className="stack" style={{ gap: 8 }}>
          {admins.map((a) => (
            <div key={a} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{a}{a === me && <span className="tagpill" style={{ marginLeft: 8 }}>You</span>}</span>
              {a !== me && <button type="button" className="btn-xs danger" onClick={() => remove(a)}>Remove</button>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: '1 1 240px' }} type="email" placeholder="new-admin@email.com" aria-label="New admin email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} />
          <button type="button" className="btn" onClick={add}>Add admin</button>
        </div>
        <ErrorText>{err}</ErrorText>
      </Section>

      <Section title="Backup" hint="Download everything (catalogue, orders, customers, reviews, messages) as one file. Do this regularly and keep the file somewhere private; it contains customer details. Receipt photos stay in Supabase Storage.">
        <div><button type="button" className="btn ghost" onClick={backup}>Download full backup</button></div>
      </Section>
    </>
  );
}

function LocalPassword() {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <Section title="Demo admin password" hint="Offline demo only. Online, admins sign in with Supabase.">
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => { setPw(e.target.value); setMsg(''); }} />
        <button type="button" className="btn" onClick={() => { if (pw.length < 8) return setMsg('Use at least 8 characters.'); set('adminpw', pw); setPw(''); setMsg('Password changed.'); }}>Change</button>
      </div>
      {msg && <div className="muted">{msg}</div>}
    </Section>
  );
}

/* --------------------------------------------------------------------- shared */
function Toggle({ on, onChange, title, sub }: { on: boolean; onChange: (v: boolean) => void; title: string; sub: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={'switch-row' + (on ? ' on' : '')}>
      <span className="switch" aria-hidden="true"><span /></span>
      <span style={{ textAlign: 'left' }}><b>{title}</b><br /><span style={{ fontSize: 13, color: 'var(--muted)' }}>{sub}</span></span>
    </button>
  );
}
