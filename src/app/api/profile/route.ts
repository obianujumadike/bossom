import { fetchMutation, fetchQuery } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api, log } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

// GET /api/profile — current user's profile
export async function GET() {
  return withSession('Failed to fetch profile', async token => {
    const profile = await fetchQuery(convex.users.me, {}, { token })
    return profile ? api.ok(profile) : api.unauthorized()
  })
}

const EDITABLE = ['full_name', 'medical_license_number', 'specialization', 'hospital_affiliation', 'phone_number'] as const

// PUT /api/profile — update current user's profile
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return api.badRequest('Invalid request body')

  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  if (Object.keys(updates).length === 0) return api.badRequest('No valid fields to update')

  return withSession('Failed to update profile', async token => {
    log.info('PUT /api/profile', { fields: Object.keys(updates) })
    return api.ok(await fetchMutation(convex.users.updateProfile, updates, { token }))
  })
}
