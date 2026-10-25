import { useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';
import { signInUser, signOutUser, signUpUser } from './auth.js';

export function AuthComponent() {
  const { configured, configurationError, session, profile, loading, profileError } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const prefix = useId();
  const navigate = useNavigate();
  const submit = async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = mode === 'signup' ? await signUpUser(email, password, username, new URL('/app', window.location.origin).href) : await signInUser(email, password);
      if (result.error) { setError(result.error.message || 'Could not access your account. Please try again.'); return; }
      setPassword('');
      if (mode === 'signup' && !result.data?.session) { setMessage('Check your email to confirm your account, then log in.'); return; }
      navigate('/app');
    } finally { lock.current = false; setBusy(false); }
  };
  const logout = async () => { setError(''); const result = await signOutUser(); if (result.error) setError(result.error.message); };
  return <div className="auth-panel">
    <h3>Access your wardrobe</h3>
    {!configured ? <><p role="status">{configurationError}</p><Link className="auth-primary" to="/app">Open local wardrobe</Link></> : loading ? <p role="status">Checking your session…</p> : session ? <>
      <p>Signed in as {profile?.username || session.user.email}.</p>
      {profileError && <p role="status">{profileError}</p>}
      <div className="auth-actions"><Link className="auth-primary" to="/app">Open wardrobe</Link><button type="button" onClick={logout}>Sign out</button></div>
    </> : <>
      <div className="auth-mode" role="group" aria-label="Account access"><button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Log in</button><button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create account</button></div>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {mode === 'signup' && <label htmlFor={`${prefix}-username`}>Username<input id={`${prefix}-username`} required minLength={2} maxLength={30} pattern={"[A-Za-z0-9][A-Za-z0-9_.\\-]{1,29}"} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /><small>2–30 letters, numbers, dots, underscores or hyphens.</small></label>}
          <label htmlFor={`${prefix}-email`}>Email<input id={`${prefix}-email`} type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label htmlFor={`${prefix}-password`}>Password<input id={`${prefix}-password`} type="password" required minLength={mode === 'signup' ? 6 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button className="auth-primary" type="submit">{busy ? mode === 'signup' ? 'Creating your account…' : 'Logging in…' : mode === 'signup' ? 'Create account' : 'Log in'}</button>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <p className="auth-storage-note">Account sign-in uses Supabase. Your wardrobe photos and saved fits stay on this app’s local server.</p>
  </div>;
}
