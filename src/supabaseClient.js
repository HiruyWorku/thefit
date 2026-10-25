import { createClient } from '@supabase/supabase-js'
import { supabaseConfiguration } from './supabase-config.mjs'

const settings = supabaseConfiguration(import.meta.env)
let client = null
let error = settings.error
if (!error) {
  try { client = createClient(settings.url, settings.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) }
  catch { error = 'Account sign-in could not start. Check the Supabase configuration.' }
}
export const supabase = client
export const supabaseConfigurationError = error
