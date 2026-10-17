import { useState, type ReactNode } from 'react';
import { useApp } from '../AppContext';
import { ErrorText, Field, useForm } from '../components/ui';
import { get, isEmail, set } from '../store';
import { go, type Route } from '../router';
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

  const submit = () => {
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
      <button type="submit" className="btn" onClick={submit}>Sign In</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <a href="#/forgot">Forgot password?</a>
        <a href="#/register">Create account</a>
      </div>
      <div style={{ background: 'var(--cream)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text2)' }}>
        Demo customer: demo@emberandeve.example / candle123{' '}
        <button type="button" className="link-btn" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => { patch({ email: 'demo@emberandeve.example', password: 'candle123' }); setErr(''); }}>Fill</button>
      </div>
      <a href="#/admin" style={{ fontSize: 12, textAlign: 'center' }}>Staff? Admin login</a>
    </AuthCard>
  );
}

export function Register() {
  const { signIn, flash } = useApp();
  const { bind, str } = useForm();
  const [err, setErr] = useState('');

  const submit = () => {
    const users = get<User[]>('users', []), em = str('email').trim().toLowerCase();
    if (!str('name').trim()) return setErr('Enter your name.');
    if (!isEmail(em)) return setErr('Enter a valid email address.');
    if (users.some((x) => x.email.toLowerCase() === em)) return setErr('An account with that email already exists.');
    if (str('password').length < 8) return setErr('Password must be at least 8 characters.');
    if (str('password') !== str('password2')) return setErr('Passwords do not match.');
    const u: User = { id: Date.now(), name: str('name').trim(), email: em, password: str('password'), address: {}, joined: new Date().toISOString().slice(0, 10) };
    set('users', users.concat(u));
    signIn(u); flash('Account created'); go('account');
  };

  return (
    <AuthCard title="Create Account">
      <div className="fields one">
        <Field label="Full name" {...bind('name')} autoComplete="name" />
        <Field label="Email" type="email" {...bind('email')} autoComplete="email" />
        <Field label="Password (8+ characters)" type="password" {...bind('password')} autoComplete="new-password" />
        <Field label="Confirm password" type="password" {...bind('password2')} autoComplete="new-password" />
      </div>
      <ErrorText>{err}</ErrorText>
      <button type="submit" className="btn" onClick={submit}>Create Account</button>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>By creating an account you agree to the <a href="#/terms">Terms</a> and <a href="#/privacy">Privacy Policy</a>.</div>
      <div style={{ fontSize: 14 }}>Already registered? <a href="#/login">Sign in</a></div>
    </AuthCard>
  );
}

export function Forgot() {
  const { bind, str } = useForm();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = () => {
    if (!isEmail(str('email'))) { setOk(''); return setErr('Enter a valid email address.'); }
    setErr(''); setOk('If an account exists for ' + str('email') + ', a reset link is on its way (demo).');
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
