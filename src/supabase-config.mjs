export function supabaseConfiguration(env = {}) {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const key = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (!url || !key) return { url: '', key: '', error: 'Account sign-in is not configured on this app yet.' };
  try { if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error(); }
  catch { return { url: '', key: '', error: 'Account sign-in is unavailable. Check the Supabase project URL.' }; }
  return { url, key, error: '' };
}
