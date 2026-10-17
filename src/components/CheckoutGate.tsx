import { useState } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, useForm } from './ui';
import { GoogleButton } from '../pages/Auth';
import { get } from '../store';
import { remote } from '../remote';
import { customerSignIn } from '../sync';
import type { User } from '../types';
import { useT } from '../i18n';

/** First thing a signed-out customer sees at checkout: sign in, create an account, or carry on as a guest. */
export function CheckoutGate({ onGuest }: { onGuest: () => void }) {
  const t = useT();
  const { signIn, flash } = useApp();
  const { bind, str } = useForm();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!str('email').trim() || !str('password')) return setErr('Enter your email and password.');
    if (remote) {
      setBusy(true);
      const e = await customerSignIn(str('email'), str('password'));
      setBusy(false);
      if (e) return setErr(e);
      flash('Signed in');
      return;
    }
    const u = get<User[]>('users', []).find((x) => x.email.toLowerCase() === str('email').trim().toLowerCase() && x.password === str('password'));
    if (!u) return setErr('Email or password is incorrect.');
    signIn(u); flash('Signed in');
  };

  return (
    <div className="gate">
      <form className="card stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        <div>
          <div className="h3">{t('I have an account')}</div>
          <div className="muted">{t('Sign in to use your saved addresses and see this order in your account.')}</div>
        </div>
        <GoogleButton next="checkout" />
        <div className="fields one">
          <Field label={t('Email')} type="email" {...bind('email')} autoComplete="username" />
          <Field label={t('Password')} type="password" {...bind('password')} autoComplete="current-password" />
        </div>
        <ErrorText>{err}</ErrorText>
        <button type="submit" className="btn" disabled={busy}>{busy ? t('Signing in…') : t('Sign in and continue')}</button>
        <a href="/forgot" style={{ fontSize: 14 }}>{t('Forgot password?')}</a>
      </form>

      <div className="stack" style={{ gap: 16 }}>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="h3">{t('New here?')}</div>
          <ul className="perks">
            <li>{t('Save addresses and check out in a few taps')}</li>
            <li>{t('Track every order and see your history')}</li>
            <li>{t('Buy your favourites again in one click')}</li>
          </ul>
          <a href="/register?next=checkout" className="btn ghost">{t('Create an account')}</a>
        </div>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="h3">{t('Just this once')}</div>
          <div className="muted">{t('No account needed. You can still track your order with your phone number and order number.')}</div>
          <button type="button" className="btn ghost" onClick={onGuest}>{t('Continue as guest')}</button>
        </div>
      </div>
    </div>
  );
}
