import { fetchAction } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/cases/[id]/images/sign — signed parameters for a direct Cloudinary upload
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: caseId } = await params
  return withSession(
    'Failed to prepare upload',
    async token => api.ok(await fetchAction(convex.images.signUpload, { caseId }, { token })),
    { caseId },
  )
}
