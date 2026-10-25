import { supabase } from './supabaseClient.js';
import { createAuthService } from './auth-service.mjs';

const service = createAuthService(supabase);
export const { signUpUser, signInUser, getCurrentUser, ensureProfile } = service;
export async function signOutUser() {
  try {
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    if (!response.ok) return { error: { message: 'Could not sign out. Please try again.' } };
  } catch { return { error: { message: 'Could not sign out. Please try again.' } }; }
  return service.signOutUser();
}
