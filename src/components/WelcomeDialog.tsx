import { useState } from 'react';
import { useApp } from '../AppContext';
import { remote } from '../remote';
import { saveProfile } from '../sync';
import { EMPTY, SL_DISTRICTS, get, set, useStored } from '../store';
import type { SavedAddress, User } from '../types';
import { ErrorText, Field, useForm } from './ui';
import { useT } from '../i18n';

/** A real first name for the header, or '' when the account only has an email (or nothing) as its name. */
export function firstName(name: string | undefined): string {
  const n = (name ?? '').trim();
  if (!n || n.includes('@')) return '';
  return n.split(/\s+/)[0];
}

const seenKey = (id: string | number) => 'ee_welcome_' + id;
const wasSeen = (id: string | number) => { try { return !!localStorage.getItem(seenKey(id)); } catch { return true; } };
const markSeen = (id: string | number) => { try { localStorage.setItem(seenKey(id), '1'); } catch { /* ignore */ } };
/** "New" means the account was created today (the join date has no time, so allow up to 2 days for time zones) */
const isNew = (joined: string | undefined) => !!joined && Date.now() - new Date(joined + 'T00:00:00').getTime() < 2 * 864e5;

/** Shown once after a new sign-up (email or Google): asks for a name and an address, both skippable. */
export function WelcomeDialog() {
  const { user, signIn, flash } = useApp();
  const users = useStored<User[]>('users', EMPTY);
  const me = users.find((u) => u.id === user?.id);
  const [closed, setClosed] = useState(false);
  // only first-time sign-ups, and only for what is still missing: nothing to ask if they already have a name and an address
  const needName = !firstName(me?.name);
  const needAddr = !(me?.addresses?.length);
  if (!user || !me || closed || wasSeen(user.id) || !isNew(me.joined) || (!needName && !needAddr)) return null;
  return <Body key={String(user.id)} me={me} needName={needName} needAddr={needAddr} onDone={(msg) => { markSeen(user.id); setClosed(true); if (msg) flash(msg); }} signIn={signIn} />;
}

function Body({ me, needName, needAddr, onDone, signIn }: { me: User; needName: boolean; needAddr: boolean; onDone: (msg?: string) => void; signIn: (u: { id: string | number; name: string; email: string }) => void }) {
  const t = useT();
  const { bind, str, set: patch } = useForm({ name: firstName(me.name) ? me.name : '', phone: me.phone ?? '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const name = (needName ? str('name') : me.name).trim(), phone = str('phone').trim();
    const hasAddr = needAddr && ['a1', 'city', 'district'].some((k) => str(k).trim());
    if (!name && !hasAddr) return onDone(); // nothing entered: same as skipping
    if (hasAddr) {
      if (!name) return setErr('Enter your name so we know who the address is for.');
      if (!/^[+\d][\d\s-]{8,}$/.test(phone)) return setErr('Enter a phone number for delivery.');
      for (const [k, msg] of [['a1', 'Enter the address.'], ['city', 'Enter the town or city.'], ['district', 'Enter the district.']] as const) if (!str(k).trim()) return setErr(msg);
    }
    const entry: SavedAddress | null = hasAddr ? { id: 'a' + Date.now().toString(36), label: 'Home', name, phone, a1: str('a1').trim(), a2: '', city: str('city').trim(), district: str('district'), post: str('post').trim(), isDefault: true } : null;
    const addresses = entry ? [...(me.addresses ?? []).map((a) => ({ ...a, isDefault: false })), entry] : undefined;
    setBusy(true);
    if (remote) {
      const e = await saveProfile({ ...(name ? { name } : {}), ...(phone ? { phone } : {}), ...(addresses ? { addresses } : {}) });
      setBusy(false);
      if (e) return setErr(e);
    } else {
      set('users', get<User[]>('users', []).map((u) => (u.id === me.id ? { ...u, name: name || u.name, phone: phone || u.phone, ...(addresses ? { addresses } : {}) } : u)));
      if (name) signIn({ id: me.id, name, email: me.email });
      setBusy(false);
    }
    onDone('Saved. You can change these any time in your profile.');
  };

  return (
    <>
      <div className="scrim" onClick={() => onDone()} />
      <div className="modal stack" style={{ width: 'min(520px, calc(100vw - 32px))', gap: 14 }} role="dialog" aria-modal="true" aria-label={t('Welcome')}>
        <div>
          <h2 className="h2" style={{ margin: 0 }}>{t('Welcome to Ember & Eve')}</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>{t('Tell us your name and where to deliver, so checkout is quicker. Both are optional. You can skip now and add them later from your profile.')}</p>
        </div>
        <div className="fields two">
          {needName && <Field label={t('Your name')} {...bind('name')} span={2} autoComplete="name" />}
          {needAddr && (
            <>
              <div className="span2 label-s" style={{ margin: '4px 0 -4px' }}>{t('Delivery address (optional)')}</div>
              <Field label={t('Phone / WhatsApp')} type="tel" {...bind('phone')} span={2} autoComplete="tel" />
              <Field label={t('Address')} {...bind('a1')} span={2} autoComplete="street-address" />
              <Field label={t('Town or city')} {...bind('city')} />
              <label className="field">{t('District')}
                <select className="input" name="district" value={str('district')} onChange={(e) => patch({ district: e.target.value })}>
                  <option value="">{t('Select district')}</option>
                  {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <Field label={t('Postal code (optional)')} {...bind('post')} span={2} />
            </>
          )}
        </div>
        <ErrorText>{err}</ErrorText>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? t('Saving…') : t('Save')}</button>
          <button type="button" className="btn ghost" onClick={() => onDone()} disabled={busy}>{t('Skip for now')}</button>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{t('You can add or change your name and addresses any time under Account, Profile and Addresses.')}</div>
      </div>
    </>
  );
}
