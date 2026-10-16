import { convexAuth } from '@convex-dev/auth/server'
import { BossomPassword } from './lib/passwordProvider'

const HOUR = 60 * 60 * 1000

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [BossomPassword],
  // Clinical data: an idle session ends after 12 hours and every session after
  // 7 days, so a shared workstation doesn't stay signed in indefinitely.
  session: {
    inactiveDurationMs: 12 * HOUR,
    totalDurationMs: 7 * 24 * HOUR,
  },
})
