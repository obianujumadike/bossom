import { ConvexError, v } from 'convex/values'
import { action, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { laterality } from './schema'
import { requireOwnedCase, requireUserId } from './lib/session'
import { shapeImage } from './lib/shape'
import { cloudinaryConfig } from './lib/env'
import { imageDeliveryUrl } from './lib/imageUrl'
import { ALLOWED_FORMATS, UPLOAD_TYPE, caseFolder, signParams, verifyUploadResponse } from './lib/cloudinary'

// Uploads go browser → Cloudinary directly (mammograms are routinely larger
// than a serverless request body allows). The server signs exactly which
// folder and delivery type the upload may use, then verifies Cloudinary's
// response signature before recording the image.

// Cloudinary's free plan rejects images over 10 MB. Checking first gives the
// radiologist a clear message instead of a Cloudinary error. Raise this (and
// the copy in src/lib/convex/server.ts and the upload page) if the plan changes.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ownedCaseId = internalQuery({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }): Promise<Id<'cases'>> => {
    const userId = await requireUserId(ctx)
    return (await requireOwnedCase(ctx, caseId, userId))._id
  },
})

/** Step 1: signed parameters for a direct upload into this case's folder. */
type SignedUpload = {
  uploadUrl: string
  maxBytes: number
  fields: Record<string, string | number>
}

export const signUpload = action({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }): Promise<SignedUpload> => {
    const id: Id<'cases'> = await ctx.runQuery(internal.images.ownedCaseId, { caseId })
    const config = cloudinaryConfig()
    const params = {
      timestamp: Math.floor(Date.now() / 1000),
      folder: caseFolder(id),
      type: UPLOAD_TYPE,
      allowed_formats: ALLOWED_FORMATS,
    }
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
      maxBytes: MAX_UPLOAD_BYTES,
      fields: { ...params, api_key: config.apiKey, signature: await signParams(params, config.apiSecret) },
    }
  },
})

const uploadResult = v.object({
  public_id: v.string(),
  version: v.number(),
  signature: v.string(),
  resource_type: v.string(),
  format: v.optional(v.string()),
  bytes: v.number(),
})

/** Step 2: record an upload Cloudinary has confirmed. */
export const register = action({
  args: {
    caseId: v.string(),
    upload: uploadResult,
    fileName: v.string(),
    fileType: v.string(),
    laterality: v.optional(laterality),
    viewPosition: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ReturnType<typeof shapeImage>> => {
    const id: Id<'cases'> = await ctx.runQuery(internal.images.ownedCaseId, { caseId: args.caseId })
    const config = cloudinaryConfig()

    if (!(await verifyUploadResponse(args.upload, config.apiSecret))) throw new ConvexError('INVALID_UPLOAD')
    // The signature proves the asset is ours; the folder proves it was signed for this case.
    if (!args.upload.public_id.startsWith(`${caseFolder(id)}/`)) throw new ConvexError('INVALID_UPLOAD')
    if (args.upload.bytes > MAX_UPLOAD_BYTES) throw new ConvexError('FILE_TOO_LARGE')

    const imageId: Id<'images'> = await ctx.runMutation(internal.images.insert, {
      caseId: id,
      fileName: args.fileName.slice(0, 255),
      fileType: args.fileType.slice(0, 100),
      fileSize: args.upload.bytes,
      publicId: args.upload.public_id,
      version: args.upload.version,
      resourceType: args.upload.resource_type,
      format: args.upload.format,
      laterality: args.laterality,
      viewPosition: args.viewPosition,
    })
    const image: Doc<'images'> = (await ctx.runQuery(internal.images.byId, { imageId }))!
    return shapeImage(image, await imageDeliveryUrl(image))
  },
})

export const byId = internalQuery({
  args: { imageId: v.id('images') },
  handler: async (ctx, { imageId }) => await ctx.db.get(imageId),
})

export const insert = internalMutation({
  args: {
    caseId: v.id('cases'),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    publicId: v.string(),
    version: v.number(),
    resourceType: v.string(),
    format: v.optional(v.string()),
    laterality: v.optional(laterality),
    viewPosition: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const c = await requireOwnedCase(ctx, args.caseId, userId)

    const existing = await ctx.db.query('images').withIndex('by_case', q => q.eq('case_id', c._id)).collect()
    // Registering the same upload twice (e.g. a retried request) is a no-op.
    const duplicate = existing.find(i => i.cloudinary_public_id === args.publicId)
    if (duplicate) return duplicate._id

    const ts = new Date().toISOString()
    const imageId = await ctx.db.insert('images', {
      case_id: c._id,
      file_name: args.fileName,
      file_size: args.fileSize,
      file_type: args.fileType,
      cloudinary_public_id: args.publicId,
      cloudinary_version: args.version,
      cloudinary_resource_type: args.resourceType,
      cloudinary_format: args.format,
      laterality: args.laterality,
      view_position: args.viewPosition,
      upload_status: 'completed',
      is_primary: existing.length === 0,
      uploaded_by: userId,
      created_at: ts,
      updated_at: ts,
    })

    if (c.status === 'pending') await ctx.db.patch(c._id, { status: 'in_progress', updated_at: ts })
    return imageId
  },
})

/** GET /api/cases/[id]/images */
export const listForCase = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const userId = await requireUserId(ctx)
    const c = await requireOwnedCase(ctx, caseId, userId)
    const images = await ctx.db.query('images').withIndex('by_case', q => q.eq('case_id', c._id)).collect()
    return await Promise.all(images.map(async i => shapeImage(i, await imageDeliveryUrl(i))))
  },
})
