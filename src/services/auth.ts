/**
 * Authentication data access layer.
 *
 * Uses Supabase Auth (auth.users) for session management and the public
 * `profiles` table for extended user data. profiles.id references auth.users.id.
 */
import { supabase } from '@/lib/supabase'
import type { Profile, ProfileInsert } from '@/lib/types'

export type AuthUser = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: string | null
}

/* ------------------------------------------------------------------ */
/* Session                                                            */
/* ------------------------------------------------------------------ */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession()
  if (!session?.user) return null
  return mapUser(session.user)
}

/**
 * Listen to auth state changes. Call from a React context/provider.
 */
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const { data: sub } = supabase.auth.onAuthStateChange(
    async (event: any, session: any) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
      callback(session?.user ? await mapUser(session.user) : null)
      return
    }
    // Initial load / other events: resolve current user.
    callback(await getCurrentUser())
  })
  return sub
}

/* ------------------------------------------------------------------ */
/* Sign up / Sign in                                                  */
/* ------------------------------------------------------------------ */
export async function signUp({
  email,
  password,
  fullName,
}: {
  email: string
  password: string
  fullName?: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName ?? null },
    },
  })
  if (error) throw error

  // When email confirmations are off, create the profile immediately.
  if (data.user) {
    await upsertProfile({
      id: data.user.id,
      email: data.user.email ?? '',
      full_name: fullName ?? null,
    })
  }

  return { data, error: null }
}

export async function signIn({
  email,
  password,
}: {
  email: string
  password: string
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  if (data.user) {
    await upsertProfile({
      id: data.user.id,
      email: data.user.email ?? '',
      full_name: null,
    })
  }
  return { data, error: null }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Profiles                                                           */
/* ------------------------------------------------------------------ */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data as Profile
}

export async function upsertProfile(profile: ProfileInsert): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(profile, {
    onConflict: 'id',
  })
  if (error) throw error
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

function mapUser(user: {
  id: string
  email?: string | null
  user_metadata: { full_name?: string | null; avatar_url?: string | null } | null
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    role: null,
  }
}
