import { ConvexError } from 'convex/values'
import type { CloudinaryConfig } from './cloudinary'

/** Cloudinary credentials, set with `npx convex env set CLOUDINARY_...`. */
export function cloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    console.error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set on the Convex deployment')
    throw new ConvexError('STORAGE_NOT_CONFIGURED')
  }
  return { cloudName, apiKey, apiSecret }
}

export function hasCloudinaryConfig(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
}
