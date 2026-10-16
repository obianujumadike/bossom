import { fetchQuery } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

// GET /api/dashboard — dashboard stats for the signed-in radiologist
export async function GET() {
  return withSession('Failed to load dashboard', async token =>
    api.ok(await fetchQuery(convex.cases.dashboard, {}, { token })),
  )
}
