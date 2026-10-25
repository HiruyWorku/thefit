import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigurationError } from './supabaseClient.js';
import { ensureProfile } from './auth.js';
import { clearOutfitPreviews } from './outfit-preview.mjs';

const AuthContext = createContext({ session: null, profile: null, loading: false, configured: false, configurationError: '', profileError: '' });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!supabase);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [serverSession, setServerSession] = useState({ token: null, error: '' });
  const [syncAttempt, setSyncAttempt] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession); setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const userId = session?.user?.id;
  const token = session?.access_token || '';
  useEffect(() => {
    clearOutfitPreviews();
  }, [userId]);
  useEffect(() => {
    if (!supabase) return;
    const controller = new AbortController();
    fetch('/api/auth/session', {
      method: token ? 'POST' : 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not open your private wardrobe.');
      if (!controller.signal.aborted) setServerSession({ token, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setServerSession({ token, error: error.message }); });
    return () => controller.abort();
  }, [token, syncAttempt]);
  useEffect(() => {
    let current = true;
    setProfile(null); setProfileError('');
    if (userId) ensureProfile(session.user).then(result => {
      if (!current) return;
      setProfile(result.profile);
      if (result.error) setProfileError('You are signed in. Profile details are temporarily unavailable.');
    });
    return () => { current = false; };
  }, [userId]);
  return <AuthContext.Provider value={{ session, profile, loading: loading || (!!supabase && serverSession.token !== token), serverError: serverSession.error, retrySession: () => { setServerSession({ token: null, error: '' }); setSyncAttempt(value => value + 1); }, configured: !!supabase, configurationError: supabaseConfigurationError, profileError }}>{children}</AuthContext.Provider>;
}
