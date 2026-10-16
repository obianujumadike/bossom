import { fetchMutation, fetchQuery } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api, log } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/cases/[id] — single case with patient, images (signed URLs) and analyses
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  return withSession(
    'Failed to fetch case',
    async token => api.ok(await fetchQuery(convex.cases.get, { id }, { token })),
    { caseId: id },
  )
}

const UPDATABLE = ['status', 'priority', 'clinical_indication', 'case_notes', 'breast_density', 'is_urgent'] as const

// PUT /api/cases/[id] — update case
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return api.badRequest('Invalid request body')

  const updates: Record<string, unknown> = {}
  for (const field of UPDATABLE) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  if (Object.keys(updates).length === 0) return api.badRequest('No valid fields to update')

  return withSession(
    'Failed to update case',
    async token => {
      log.info('PUT /api/cases/[id]', { caseId: id, fields: Object.keys(updates) })
      return api.ok(await fetchMutation(convex.cases.update, { id, ...updates }, { token }))
    },
    { caseId: id },
  )
}
