import { supabase } from './supabaseClient'

/**
 * Register a new user and insert their public profile record
 */
export async function signUpUser(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    console.error('Sign up error:', error.message)
    return { error }
  }

  // Create public profile row linked to auth user ID
  if (data?.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          username: username.trim().toLowerCase(),
          is_public: true
        }
      ])

    if (profileError) {
      console.error('Profile creation error:', profileError.message)
      return { data, error: profileError }
    }
  }

  return { data, error: null }
}

/**
 * Sign in an existing user with email and password
 */
export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Sign in error:', error.message)
    return { error }
  }

  return { data, error: null }
}

/**
 * Sign out the currently logged in user
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Sign out error:', error.message)
  return { error }
}

/**
 * Get current active session / user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Fetch the user profile record
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { ...user, profile }
}