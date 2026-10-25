import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { App } from './App.jsx';
import { useAuth } from './AuthProvider.jsx';
import { signOutUser } from './auth.js';

export function WardrobeRoute() {
  const { session, profile, profileError, loading, configured, configurationError, serverError, retrySession } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    if (busy) return;
    setBusy(true); setError('');
    const result = await signOutUser();
    if (result.error) setError(result.error.message);
    setBusy(false);
  };
  if (!configured) return <main className="auth-route-status"><h1>Sign-in is unavailable</h1><p>{configurationError}</p><Link to="/#account">Back to sign in</Link></main>;
  if (loading) return <main className="auth-route-status" role="status">Opening your private wardrobe…</main>;
  if (!session) return <Navigate to="/#account" replace />;
  if (serverError) return <main className="auth-route-status"><h1>Could not open your wardrobe</h1><p role="alert">{serverError}</p><button type="button" onClick={retrySession}>Try again</button><button type="button" onClick={logout}>Sign out</button></main>;
  return <>
    <nav className="app-site-nav" aria-label="Site navigation"><Link to="/">thefit</Link><div>{session ? <><span>{profile?.username || session.user.email}</span><button type="button" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button></> : configured ? <Link to="/#account">Log in</Link> : <span>Local wardrobe</span>}</div></nav>
    {(error || profileError) && <p className="app-account-notice" role={error ? 'alert' : 'status'}>{error || profileError}</p>}
    <App key={session.user.id} userId={session.user.id} />
  </>;
}
