import { fetchAction, fetchQuery } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api, log } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

const LATERALITY = ['Left', 'Right', 'Bilateral'] as const

/**
 * POST /api/cases/[id]/images — record an image the browser has uploaded
 * straight to Cloudinary (see /images/sign). Body: { upload, fileName,
 * fileType, laterality?, viewPosition? } where `upload` is Cloudinary's
 * upload response; Convex verifies its signature before saving anything.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: caseId } = await params
  const body = await request.json().catch(() => null)
  const u = body?.upload
  if (
    !u ||
    typeof u.public_id !== 'string' ||
    typeof u.signature !== 'string' ||
    typeof u.resource_type !== 'string' ||
    !Number.isFinite(Number(u.version)) ||
    !Number.isFinite(Number(u.bytes))
  ) {
    return api.badRequest('Missing upload result')
  }

  return withSession(
    'Failed to save image',
    async token => {
      const image = await fetchAction(
        convex.images.register,
        {
          caseId,
          upload: {
            public_id: u.public_id,
            version: Number(u.version),
            signature: u.signature,
            resource_type: u.resource_type,
            format: typeof u.format === 'string' && u.format ? u.format : undefined,
            bytes: Number(u.bytes),
          },
          fileName: typeof body.fileName === 'string' ? body.fileName : u.original_filename ?? 'image',
          fileType: typeof body.fileType === 'string' && body.fileType ? body.fileType : 'application/octet-stream',
          laterality: LATERALITY.includes(body.laterality) ? body.laterality : undefined,
          viewPosition: typeof body.viewPosition === 'string' ? body.viewPosition : undefined,
        },
        { token },
      )
      log.info('Image recorded', { caseId, imageId: image.id })
      return api.created(image, 'Image uploaded successfully')
    },
    { caseId },
  )
}

// GET /api/cases/[id]/images — list images for a case
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: caseId } = await params
  return withSession(
    'Failed to fetch images',
    async token => api.ok(await fetchQuery(convex.images.listForCase, { caseId }, { token })),
    { caseId },
  )
}
