import { ConvexError, v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireUserId } from './lib/session'
import { shapeProfile } from './lib/shape'
import { isValidPhone } from './lib/rules'

/** The signed-in radiologist's profile, or null when signed out. */
export const me = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    return user ? shapeProfile(user) : null
  },
})

/** PUT /api/profile. Email and role are not editable here. */
export const updateProfile = mutation({
  args: {
    full_name: v.optional(v.string()),
    medical_license_number: v.optional(v.string()),
    specialization: v.optional(v.string()),
    hospital_affiliation: v.optional(v.union(v.string(), v.null())),
    phone_number: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const patch: Partial<Doc<'users'>> = { updated_at: new Date().toISOString() }

    const clean = (s: string | null | undefined) => (s ?? '').trim().slice(0, 200)

    if (args.full_name !== undefined) {
      if (!clean(args.full_name)) throw new ConvexError('INVALID_INPUT')
      patch.full_name = clean(args.full_name)
      patch.name = patch.full_name
    }
    if (args.medical_license_number !== undefined) {
      if (!clean(args.medical_license_number)) throw new ConvexError('INVALID_INPUT')
      patch.medical_license_number = clean(args.medical_license_number)
    }
    if (args.specialization !== undefined) patch.specialization = clean(args.specialization) || 'Radiology'
    if (args.hospital_affiliation !== undefined) patch.hospital_affiliation = clean(args.hospital_affiliation) || undefined
    if (args.phone_number !== undefined) {
      const phone = clean(args.phone_number)
      if (phone && !isValidPhone(phone)) throw new ConvexError('INVALID_PHONE')
      patch.phone_number = phone || undefined
    }

    await ctx.db.patch(userId, patch)
    return shapeProfile((await ctx.db.get(userId))!)
  },
})
