const unavailable = () => ({ data: null, error: { message: 'Account sign-in is not configured. You can still open the local wardrobe.' } });
const connectionError = () => ({ data: null, error: { message: 'Could not reach the account service. Please try again.' } });
const usernamePattern = /^[a-z0-9][a-z0-9_.-]{1,29}$/;

export function createAuthService(client) {
  const pendingProfiles = new Map();
  async function signUpUser(email, password, username, redirectTo) {
    if (!client) return unavailable();
    const normalized = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!usernamePattern.test(normalized)) return { data: null, error: { message: 'Choose a username with 2–30 letters, numbers, dots, underscores or hyphens.' } };
    if (typeof password !== 'string' || password.length < 6) return { data: null, error: { message: 'Use a password with at least 6 characters.' } };
    try {
      // Metadata survives email confirmation. Profile creation waits for an
      // authenticated session instead of trying an anonymous database insert.
      return await client.auth.signUp({ email: email.trim(), password, options: { data: { username: normalized }, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) } });
    } catch { return connectionError(); }
  }
  async function signInUser(email, password) {
    if (!client) return unavailable();
    try { return await client.auth.signInWithPassword({ email: email.trim(), password }); }
    catch { return connectionError(); }
  }
  async function signOutUser() {
    if (!client) return { error: null };
    try { return await client.auth.signOut(); } catch { return connectionError(); }
  }
  async function ensureProfile(user) {
    if (!client || !user?.id) return { profile: null, error: null };
    if (pendingProfiles.has(user.id)) return pendingProfiles.get(user.id);
    const task = (async () => {
      try {
        const existing = await client.from('profiles').select('id,username,is_public').eq('id', user.id).maybeSingle();
        if (existing.error) return { profile: null, error: existing.error };
        if (existing.data) return { profile: existing.data, error: null };
        const metadataName = typeof user.user_metadata?.username === 'string' ? user.user_metadata.username.trim().toLowerCase() : '';
        const username = usernamePattern.test(metadataName || '') ? metadataName : `member-${user.id.slice(0, 8)}`;
        const result = await client.from('profiles').upsert({ id: user.id, username, is_public: false }, { onConflict: 'id', ignoreDuplicates: true }).select('id,username,is_public').maybeSingle();
        return { profile: result.data, error: result.error };
      } catch { return { profile: null, error: connectionError().error }; }
    })();
    pendingProfiles.set(user.id, task);
    try { return await task; } finally { pendingProfiles.delete(user.id); }
  }
  async function getCurrentUser() {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user) return null;
      const result = await ensureProfile(data.user);
      return { ...data.user, profile: result.profile, profileError: result.error?.message || '' };
    } catch { return null; }
  }
  return { signUpUser, signInUser, signOutUser, ensureProfile, getCurrentUser };
}
