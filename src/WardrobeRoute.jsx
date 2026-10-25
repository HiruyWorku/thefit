import { useState } from 'react';
import { Link } from 'react-router-dom';
import { App } from './App.jsx';
import { useAuth } from './AuthProvider.jsx';
import { signOutUser } from './auth.js';

export function WardrobeRoute() {
  const { session, profile, profileError, configured } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    if (busy) return;
    setBusy(true); setError('');
    const result = await signOutUser();
    if (result.error) setError(result.error.message);
    setBusy(false);
  };
  return <>
    <nav className="app-site-nav" aria-label="Site navigation"><Link to="/">thefit</Link><div>{session ? <><span>{profile?.username || session.user.email}</span><button type="button" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button></> : configured ? <Link to="/#account">Log in</Link> : <span>Local wardrobe</span>}</div></nav>
    {(error || profileError) && <p className="app-account-notice" role={error ? 'alert' : 'status'}>{error || profileError}</p>}
    <App />
  </>;
}
