import { v } from 'convex/values'
import { internalQuery } from './_generated/server'
import { PASSWORD_PROVIDER_ID } from './lib/rules'

/** Used by the password provider to decide sign-up and sign-in outcomes. */
export const byEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', q =>
        q.eq('provider', PASSWORD_PROVIDER_ID).eq('providerAccountId', email),
      )
      .unique()
    // A user row with this email but no password account (e.g. a half-finished
    // migration) still counts as taken.
    const user = account
      ? null
      : await ctx.db.query('users').withIndex('email', q => q.eq('email', email)).first()

    return {
      exists: account !== null || user !== null,
      hasSecret: !!account?.secret,
      hasLegacyHash: !!account?.secret && /^\$2[aby]\$/.test(account.secret),
    }
  },
})
