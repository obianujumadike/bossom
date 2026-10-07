'use client'

import { createContext, useContext } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '@/convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'

type UserProfile = NonNullable<FunctionReturnType<typeof api.users.me>>

interface AuthUser {
  id: string
  email: string
}

interface AuthContextType {
  user: AuthUser | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  /** Kept for existing callers; the profile is a live Convex query now. */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * The PWA service worker caches pages and API responses. Clearing them on
 * sign-out stops the next person on a shared machine from seeing cached
 * clinical data.
 */
async function clearServiceWorkerCaches() {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map(key => caches.delete(key)))
  } catch {
    // Cache Storage can be unavailable (private mode); nothing to clear then.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')
  const { signOut: convexSignOut } = useAuthActions()

  const profile = isAuthenticated ? (me ?? null) : null
  const loading = isLoading || (isAuthenticated && me === undefined)

  const signOut = async () => {
    try {
      await convexSignOut()
    } finally {
      await clearServiceWorkerCaches()
      window.location.replace('/login')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: profile ? { id: profile.id, email: profile.email } : null,
        profile,
        loading,
        signOut,
        refreshProfile: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
