/**
 * Auth context.
 *
 * Provides the signed-in user (from Supabase Auth + profiles) and auth actions
 * to the whole app. Consume with `useAuth()`.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getCurrentUser,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
  type AuthUser,
} from '@/services/auth'

const AuthContext = createContext<{
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
} | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const current = await getCurrentUser()
      setUser(current)
      setLoading(false)
    })()

    const sub = onAuthStateChange((u) => {
      setUser(u)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleSignIn = async (email: string, password: string) => {
    await signIn({ email, password })
  }

  const handleSignUp = async (
    email: string,
    password: string,
    fullName?: string,
  ) => {
    await signUp({ email, password, fullName })
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
