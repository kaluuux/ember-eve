import { useState, type ReactNode } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, useForm } from '../components/ui';
import { get, isEmail, set } from '../store';
import { go, type Route } from '../router';
import { remote } from '../remote';
import { customerSignIn, customerSignUp, requestReset, updatePassword } from '../sync';
import type { User } from '../types';

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="narrow" style={{ maxWidth: 440 }}>
      <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()} noValidate>
        <h1 className="h1">{title}</h1>
        {children}
      </form>
    </section>
  );
}

export function Login({ route }: { route: Route }) {
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
    <AuthCard title="Sign In">
      <div className="fields one">
        <Field label="Email" type="email" {...bind('email')} autoComplete="username" />
        <Field label="Password" type="password" {...bind('password')} autoComplete="current-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <a href="#/forgot">Forgot password?</a>
        <a href="#/register">Create account</a>
      </div>
      {!remote && (
        <div style={{ background: 'var(--cream)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text2)' }}>
          Demo customer: demo@emberandeve.example / candle123{' '}
          <button type="button" className="link-btn" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => { patch({ email: 'demo@emberandeve.example', password: 'candle123' }); setErr(''); }}>Fill</button>
        </div>
      )}
      <a href="#/admin" style={{ fontSize: 12, textAlign: 'center' }}>Staff? Admin login</a>
    </AuthCard>
  );
}

export function Register() {
  const { signIn, flash } = useApp();
  const { bind, str } = useForm();
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
      if (r.signedIn) { flash('Account created'); return go('account'); }
      setErr(''); return setSent(em);
    }
    const u: User = { id: Date.now(), name: str('name').trim(), email: em, password: str('password'), address: {}, joined: new Date().toISOString().slice(0, 10) };
    set('users', users.concat(u));
    signIn(u); flash('Account created'); go('account');
  };

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <p style={{ margin: 0 }}>We sent a confirmation link to <b>{sent}</b>. Open it to activate your account, then sign in.</p>
        <a href="#/login" className="btn">Go to Sign In</a>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create Account">
      <div className="fields one">
        <Field label="Full name" {...bind('name')} autoComplete="name" />
        <Field label="Email" type="email" {...bind('email')} autoComplete="email" />
        <Field label="Password (8+ characters)" type="password" {...bind('password')} autoComplete="new-password" />
        <Field label="Confirm password" type="password" {...bind('password2')} autoComplete="new-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>By creating an account you agree to the <a href="#/terms">Terms</a> and <a href="#/privacy">Privacy Policy</a>.</div>
      <div style={{ fontSize: 14 }}>Already registered? <a href="#/login">Sign in</a></div>
    </AuthCard>
  );
}

export function Forgot() {
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
    <AuthCard title="Reset Password">
      <p className="muted" style={{ margin: 0 }}>Enter your email and we will send a reset link.</p>
      <div className="fields one"><Field label="Email" type="email" {...bind('email')} /></div>
      <ErrorText>{err}</ErrorText>
      {ok && <div className="ok">{ok}</div>}
      <button type="submit" className="btn" onClick={submit}>Send Reset Link</button>
      <a href="#/login" style={{ fontSize: 14 }}>Back to sign in</a>
    </AuthCard>
  );
}

/** Landing page after the emailed reset link: choose a new password. */
export function Reset() {
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
    <AuthCard title="Choose a New Password">
      <div className="fields one">
        <Field label="New password (8+ characters)" type="password" {...bind('password')} autoComplete="new-password" />
        <Field label="Confirm new password" type="password" {...bind('password2')} autoComplete="new-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save Password'}</button>
    </AuthCard>
  );
}
