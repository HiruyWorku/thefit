import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigurationError } from './supabaseClient.js';
import { ensureProfile } from './auth.js';

const AuthContext = createContext({ session: null, profile: null, loading: false, configured: false, configurationError: '', profileError: '' });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!supabase);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession); setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const userId = session?.user?.id;
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
  return <AuthContext.Provider value={{ session, profile, loading, configured: !!supabase, configurationError: supabaseConfigurationError, profileError }}>{children}</AuthContext.Provider>;
}
