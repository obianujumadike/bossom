import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

// Identity always comes from the session token, never from arguments.

export async function requireUserId(ctx: QueryCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('UNAUTHENTICATED')
  return userId
}

/**
 * Loads a case only if it belongs to the signed-in radiologist. Takes a plain
 * string so malformed or pre-migration (UUID) ids become NOT_FOUND rather
 * than an argument-validation error.
 */
export async function requireOwnedCase(
  ctx: QueryCtx,
  caseId: string,
  userId: Id<'users'>,
): Promise<Doc<'cases'>> {
  const id = ctx.db.normalizeId('cases', caseId)
  const found = id ? await ctx.db.get(id) : null
  if (!found || found.radiologist_id !== userId) throw new ConvexError('NOT_FOUND')
  return found
}
