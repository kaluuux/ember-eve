import { useState, type ReactNode } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, useForm } from '../components/ui';
import { get, isEmail, set } from '../store';
import { go, type Route } from '../router';
import { remote } from '../remote';
import { customerSignIn, customerSignUp, requestReset, signInWithGoogle, updatePassword } from '../sync';
import type { User } from '../types';
import { useT } from '../i18n';

/** "Continue with Google" (online only), shared by sign in, sign up and checkout. */
export function GoogleButton({ next, label = 'Continue with Google' }: { next: string; label?: string }) {
  const t = useT();
  const [err, setErr] = useState('');
  if (!remote) return null;
  return (
    <>
      <button type="button" className="google-btn" onClick={async () => { const e = await signInWithGoogle(next); if (e) setErr(e); }}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
        {t(label)}
      </button>
      {err && <div className="err">{err}</div>}
      <div className="or-line"><span>{t('or use your email')}</span></div>
    </>
  );
}

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  return (
    <section className="narrow" style={{ maxWidth: 440 }}>
      <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
        <h1 className="h1">{t(title)}</h1>
        {children}
      </form>
    </section>
  );
}

export function Login({ route }: { route: Route }) {
  const t = useT();
  const { signIn, flash } = useApp();
  const { bind, str, set: patch } = useForm();
  const [err, setErr] = useState('');

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (remote) {
      setBusy(true);
      const e = await customerSignIn(str('email'), str('password'));
      setBusy(false);
      if (e) return setErr(e);
      flash('Signed in'); return go(route.q.next || 'account');
    }
    const u = get<User[]>('users', []).find((x) => x.email.toLowerCase() === str('email').trim().toLowerCase() && x.password === str('password'));
    if (!u) return setErr('Email or password is incorrect.');
    signIn(u); flash('Signed in'); go(route.q.next || 'account');
  };

  return (
    <AuthCard title={t('Sign In')}>
      <GoogleButton next={route.q.next || 'account'} />
      <div className="fields one">
        <Field label={t('Email')} type="email" {...bind('email')} autoComplete="username" />
        <Field label={t('Password')} type="password" {...bind('password')} autoComplete="current-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? t('Signing in…') : t('Sign In')}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <a href="/forgot">{t('Forgot password?')}</a>
        <a href={'/register' + (route.q.next ? '?next=' + route.q.next : '')}>{t('Create account')}</a>
      </div>
      {!remote && (
        <div style={{ background: 'var(--cream)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text2)' }}>
          {t('Demo customer: demo@emberandeve.example / candle123')}{' '}
          <button type="button" className="link-btn" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => { patch({ email: 'demo@emberandeve.example', password: 'candle123' }); setErr(''); }}>{t('Fill')}</button>
        </div>
      )}
      <a href="/admin" style={{ fontSize: 12, textAlign: 'center' }}>{t('Staff? Admin login')}</a>
    </AuthCard>
  );
}

export function Register({ route }: { route: Route }) {
  const t = useT();
  const { signIn, flash } = useApp();
  const { bind, str } = useForm({ email: route.q.email ?? '' });
  const [err, setErr] = useState('');

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const submit = async () => {
    const users = get<User[]>('users', []), em = str('email').trim().toLowerCase();
    if (!str('name').trim()) return setErr('Enter your name.');
    if (!isEmail(em)) return setErr('Enter a valid email address.');
    if (!remote && users.some((x) => x.email.toLowerCase() === em)) return setErr('An account with that email already exists.');
    if (str('password').length < 8) return setErr('Password must be at least 8 characters.');
    if (str('password') !== str('password2')) return setErr('Passwords do not match.');
    if (remote) {
      setBusy(true);
      const r = await customerSignUp(str('name'), em, str('password'));
      setBusy(false);
      if (r.error) return setErr(r.error);
      if (r.signedIn) { flash('Account created'); return go(route.q.next || 'account'); }
      setErr(''); return setSent(em);
    }
    const u: User = { id: Date.now(), name: str('name').trim(), email: em, password: str('password'), address: {}, joined: new Date().toISOString().slice(0, 10) };
    set('users', users.concat(u));
    signIn(u); flash('Account created'); go(route.q.next || 'account');
  };

  if (sent) {
    return (
      <AuthCard title={t('Check your email')}>
        <p style={{ margin: 0 }}>{t('We sent a confirmation link to')}{' '}<b>{sent}</b>{t('. Open it to activate your account, then sign in.')}</p>
        <a href={'/login' + (route.q.next ? '?next=' + route.q.next : '')} className="btn">{t('Go to Sign In')}</a>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('Create Account')}>
      <GoogleButton next={route.q.next || 'account'} label={t('Sign up with Google')} />
      <div className="fields one">
        <Field label={t('Full name')} {...bind('name')} autoComplete="name" />
        <Field label={t('Email')} type="email" {...bind('email')} autoComplete="email" />
        <Field label={t('Password (8+ characters)')} type="password" {...bind('password')} autoComplete="new-password" />
        <Field label={t('Confirm password')} type="password" {...bind('password2')} autoComplete="new-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? t('Creating…') : t('Create Account')}</button>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('By creating an account you agree to the')}{' '}<a href="/terms">{t('Terms')}</a>{' '}{t('and')}{' '}<a href="/privacy">{t('Privacy Policy')}</a>.</div>
      <div style={{ fontSize: 14 }}>{t('Already registered?')}{' '}<a href={'/login' + (route.q.next ? '?next=' + route.q.next : '')}>{t('Sign in')}</a></div>
    </AuthCard>
  );
}

export function Forgot() {
  const t = useT();
  const { bind, str } = useForm();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = async () => {
    if (!isEmail(str('email'))) { setOk(''); return setErr('Enter a valid email address.'); }
    if (remote) {
      const e = await requestReset(str('email'));
      if (e) { setOk(''); return setErr(e); }
    }
    setErr(''); setOk('If an account exists for ' + str('email') + ', a reset link is on its way.' + (remote ? '' : ' (demo)'));
  };

  return (
    <AuthCard title={t('Reset Password')}>
      <p className="muted" style={{ margin: 0 }}>{t('Enter your email and we will send a reset link.')}</p>
      <div className="fields one"><Field label={t('Email')} type="email" {...bind('email')} /></div>
      <ErrorText>{err}</ErrorText>
      {ok && <div className="ok">{ok}</div>}
      <button type="submit" className="btn" onClick={submit}>{t('Send Reset Link')}</button>
      <a href="/login" style={{ fontSize: 14 }}>{t('Back to sign in')}</a>
    </AuthCard>
  );
}

/** Landing page after the emailed reset link: choose a new password. */
export function Reset() {
  const t = useT();
  const { flash } = useApp();
  const { bind, str } = useForm();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (str('password').length < 8) return setErr('Password must be at least 8 characters.');
    if (str('password') !== str('password2')) return setErr('Passwords do not match.');
    setBusy(true);
    const e = await updatePassword(str('password'));
    setBusy(false);
    if (e) return setErr(e);
    flash('Password updated'); go('account');
  };

  return (
    <AuthCard title={t('Choose a New Password')}>
      <div className="fields one">
        <Field label={t('New password (8+ characters)')} type="password" {...bind('password')} autoComplete="new-password" />
        <Field label={t('Confirm new password')} type="password" {...bind('password2')} autoComplete="new-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? t('Saving…') : t('Save Password')}</button>
    </AuthCard>
  );
}
