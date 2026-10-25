import { supabase } from './supabaseClient.js';
import { createAuthService } from './auth-service.mjs';

export const { signUpUser, signInUser, signOutUser, getCurrentUser, ensureProfile } = createAuthService(supabase);
