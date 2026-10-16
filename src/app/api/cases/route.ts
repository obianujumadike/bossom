import { fetchMutation, fetchQuery } from 'convex/nextjs'
import { api as convex } from '@/convex/_generated/api'
import { api, log } from '@/lib/api/response'
import { withSession } from '@/lib/convex/server'

// GET /api/cases — list cases for authenticated radiologist
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filters = {
    status: searchParams.get('status') ?? undefined,
    priority: searchParams.get('priority') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  }
  return withSession('Failed to fetch cases', async token => {
    log.info('GET /api/cases', filters)
    return api.ok(await fetchQuery(convex.cases.list, filters, { token }))
  })
}

const GENDERS = ['Female', 'Male', 'Other'] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const DENSITIES = ['A', 'B', 'C', 'D'] as const

const optionalString = (x: unknown) => (typeof x === 'string' ? x : x === null ? null : undefined)
const oneOf = <T extends string>(x: unknown, allowed: readonly T[]) =>
  allowed.includes(x as T) ? (x as T) : undefined

// POST /api/cases — create a new case with patient
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return api.badRequest('Invalid request body')

  const patientAge = Number(body.patientAge)
  if (!body.patientId || typeof body.patientId !== 'string' || !Number.isFinite(patientAge)) {
    return api.badRequest('Patient ID and age are required')
  }

  return withSession('Failed to create case', async token => {
    const newCase = await fetchMutation(
      convex.cases.create,
      {
        patientId: body.patientId,
        patientAge,
        patientGender: oneOf(body.patientGender, GENDERS),
        clinicalIndication: optionalString(body.clinicalIndication),
        referringPhysician: optionalString(body.referringPhysician),
        priority: oneOf(body.priority, PRIORITIES),
        studyType: typeof body.studyType === 'string' ? body.studyType : undefined,
        breastDensity: oneOf(body.breastDensity, DENSITIES),
        caseNotes: optionalString(body.caseNotes),
        clinicalHistory: optionalString(body.clinicalHistory),
        familyHistory: optionalString(body.familyHistory),
        medications: optionalString(body.medications),
        priorMammograms: optionalString(body.priorMammograms),
      },
      { token },
    )
    log.info('Case created', { caseId: newCase.id, caseNumber: newCase.case_number })
    return api.created(newCase, 'Case created successfully')
  })
}
