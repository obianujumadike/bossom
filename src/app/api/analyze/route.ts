import { fetchAction } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api, log } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

/**
 * POST /api/analyze — { imageId, caseId }
 * The analysis runs in a Convex action (convex/analyses.ts), which owns the
 * model call and writes the result; this route only forwards the session.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.imageId !== 'string' || typeof body.caseId !== 'string') {
    return api.badRequest('imageId and caseId are required')
  }
  const { imageId, caseId } = body as { imageId: string; caseId: string }

  return withSession(
    'Analysis failed',
    async token => {
      log.info('POST /api/analyze', { caseId, imageId })
      const result = await fetchAction(convex.analyses.run, { caseId, imageId }, { token })
      log.info('Analysis completed', { caseId, imageId, analysisId: result.analysisId, birads: result.birads_category })
      return api.ok(result)
    },
    { caseId, imageId },
  )
}
