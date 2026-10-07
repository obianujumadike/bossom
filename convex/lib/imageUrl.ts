import type { Doc } from '../_generated/dataModel'
import { deliveryFormat, signedDeliveryUrl } from './cloudinary'
import { cloudinaryConfig, hasCloudinaryConfig } from './env'

/** Signed URL for viewing an image, or null while Cloudinary isn't configured. */
export async function imageDeliveryUrl(image: Doc<'images'>): Promise<string | null> {
  if (!hasCloudinaryConfig()) return null
  return await signedDeliveryUrl(cloudinaryConfig(), {
    publicId: image.cloudinary_public_id,
    version: image.cloudinary_version,
    resourceType: image.cloudinary_resource_type,
    format: deliveryFormat(image.cloudinary_resource_type, image.cloudinary_format),
  })
}
