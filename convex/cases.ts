import { ConvexError, v } from 'convex/values'
import { mutation, query, type QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { breastDensity, casePriority, caseStatus, gender } from './schema'
import { requireOwnedCase, requireUserId } from './lib/session'
import { shapeAnalysis, shapeCase, shapeImage, shapePatient, shapeRegion } from './lib/shape'
import { imageDeliveryUrl } from './lib/imageUrl'

const now = () => new Date().toISOString()

async function summarise(ctx: QueryCtx, c: Doc<'cases'>) {
  const [patient, images, analyses] = await Promise.all([
    ctx.db.get(c.patient_id),
    ctx.db.query('images').withIndex('by_case', q => q.eq('case_id', c._id)).collect(),
    ctx.db.query('analyses').withIndex('by_case', q => q.eq('case_id', c._id)).collect(),
  ])
  return {
    ...shapeCase(c),
    patients: patient ? { id: patient._id, patient_id: patient.patient_id, age: patient.age, gender: patient.gender } : null,
    images: images.map(i => ({ id: i._id })),
    analyses: analyses.map(a => {
      const s = shapeAnalysis(a)
      return {
        id: s.id,
        birads_category: s.birads_category,
        confidence_score: s.confidence_score,
        analysis_status: s.analysis_status,
      }
    }),
  }
}

const contains = (haystack: string | null | undefined, needle: string) =>
  !!haystack && haystack.toLowerCase().includes(needle)

/** GET /api/cases — the radiologist's own cases, newest first. */
export const list = query({
  args: {
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    let cases = await ctx.db
      .query('cases')
      .withIndex('by_radiologist', q => q.eq('radiologist_id', userId))
      .order('desc')
      .collect()

    if (args.status && args.status !== 'all') cases = cases.filter(c => c.status === args.status)
    if (args.priority && args.priority !== 'all') cases = cases.filter(c => c.priority === args.priority)

    const rows = await Promise.all(cases.map(c => summarise(ctx, c)))

    const needle = args.search?.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      r =>
        contains(r.case_number, needle) ||
        contains(r.clinical_indication, needle) ||
        contains(r.patients?.patient_id, needle),
    )
  },
})

/** GET /api/cases/[id] — one case with patient, images (signed URLs) and analyses. */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx)
    const c = await requireOwnedCase(ctx, id, userId)

    const [patient, images, analyses] = await Promise.all([
      ctx.db.get(c.patient_id),
      ctx.db.query('images').withIndex('by_case', q => q.eq('case_id', c._id)).collect(),
      ctx.db.query('analyses').withIndex('by_case', q => q.eq('case_id', c._id)).collect(),
    ])

    return {
      ...shapeCase(c),
      patients: patient ? shapePatient(patient) : null,
      images: await Promise.all(images.map(async i => shapeImage(i, await imageDeliveryUrl(i)))),
      analyses: await Promise.all(
        analyses.map(async a => ({
          ...shapeAnalysis(a),
          regions_of_interest: (
            await ctx.db.query('regions_of_interest').withIndex('by_analysis', q => q.eq('analysis_id', a._id)).collect()
          ).map(shapeRegion),
        })),
      ),
    }
  },
})

const optionalText = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** POST /api/cases — create a case, reusing the radiologist's patient record for the same MRN. */
export const create = mutation({
  args: {
    patientId: v.string(),
    patientAge: v.number(),
    patientGender: v.optional(gender),
    clinicalIndication: v.optional(v.union(v.string(), v.null())),
    referringPhysician: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(casePriority),
    studyType: v.optional(v.string()),
    breastDensity: v.optional(v.union(breastDensity, v.null())),
    caseNotes: v.optional(v.union(v.string(), v.null())),
    clinicalHistory: v.optional(v.union(v.string(), v.null())),
    familyHistory: v.optional(v.union(v.string(), v.null())),
    medications: v.optional(v.union(v.string(), v.null())),
    priorMammograms: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const mrn = args.patientId.trim()
    if (!mrn) throw new ConvexError('INVALID_INPUT')
    if (!Number.isFinite(args.patientAge) || args.patientAge < 0 || args.patientAge > 130) {
      throw new ConvexError('INVALID_INPUT')
    }

    const ts = now()

    // Scoped to the creating radiologist: one radiologist's MRN must not
    // attach a case to another radiologist's patient record.
    const existing = await ctx.db
      .query('patients')
      .withIndex('by_creator_and_mrn', q => q.eq('created_by', userId).eq('patient_id', mrn))
      .first()

    const patientId =
      existing?._id ??
      (await ctx.db.insert('patients', {
        patient_id: mrn,
        age: Math.round(args.patientAge),
        gender: args.patientGender ?? 'Female',
        created_by: userId,
        created_at: ts,
        updated_at: ts,
      }))

    const caseId = await ctx.db.insert('cases', {
      case_number: `BLS-${Date.now().toString(36).toUpperCase()}`,
      patient_id: patientId,
      radiologist_id: userId,
      status: 'pending',
      priority: args.priority ?? 'normal',
      clinical_indication: optionalText(args.clinicalIndication),
      referring_physician: optionalText(args.referringPhysician),
      study_date: ts.split('T')[0],
      study_type: optionalText(args.studyType) ?? 'Screening Mammogram',
      breast_density: args.breastDensity ?? undefined,
      case_notes: optionalText(args.caseNotes),
      is_urgent: args.priority === 'urgent',
      created_at: ts,
      updated_at: ts,
    })

    const clinicalNotes = optionalText(args.clinicalHistory)
    const medications = optionalText(args.medications)
    const familyHistory = optionalText(args.familyHistory)
    const prior = args.priorMammograms && args.priorMammograms !== 'unknown' ? optionalText(args.priorMammograms) : undefined
    if (clinicalNotes || medications || familyHistory || prior) {
      await ctx.db.insert('patient_clinical_history', {
        patient_id: patientId,
        clinical_notes: clinicalNotes,
        current_medications: medications,
        previous_mammograms_results: prior,
        risk_factors: familyHistory ? { family_history: familyHistory } : undefined,
        created_at: ts,
        updated_at: ts,
      })
    }

    return shapeCase((await ctx.db.get(caseId))!)
  },
})

/** PUT /api/cases/[id] */
export const update = mutation({
  args: {
    id: v.string(),
    status: v.optional(caseStatus),
    priority: v.optional(casePriority),
    clinical_indication: v.optional(v.union(v.string(), v.null())),
    case_notes: v.optional(v.union(v.string(), v.null())),
    breast_density: v.optional(v.union(breastDensity, v.null())),
    is_urgent: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx)
    const c = await requireOwnedCase(ctx, id, userId)

    const patch: Partial<Doc<'cases'>> = { updated_at: now() }
    if (fields.status !== undefined) patch.status = fields.status
    if (fields.priority !== undefined) patch.priority = fields.priority
    if (fields.is_urgent !== undefined) patch.is_urgent = fields.is_urgent
    if (fields.clinical_indication !== undefined) patch.clinical_indication = optionalText(fields.clinical_indication)
    if (fields.case_notes !== undefined) patch.case_notes = optionalText(fields.case_notes)
    if (fields.breast_density !== undefined) patch.breast_density = fields.breast_density ?? undefined
    if (fields.status === 'completed') patch.completed_at = now()

    await ctx.db.patch(c._id, patch)
    return shapeCase((await ctx.db.get(c._id))!)
  },
})

/** GET /api/dashboard */
export const dashboard = query({
  args: {},
  handler: async ctx => {
    const userId = await requireUserId(ctx)
    const cases = await ctx.db
      .query('cases')
      .withIndex('by_radiologist', q => q.eq('radiologist_id', userId))
      .order('desc')
      .collect()

    const count = (status: Doc<'cases'>['status']) => cases.filter(c => c.status === status).length
    const recent = await Promise.all(
      cases.slice(0, 5).map(async c => {
        const s = await summarise(ctx, c)
        return {
          ...shapeCase(c),
          patients: s.patients && { patient_id: s.patients.patient_id, age: s.patients.age, gender: s.patients.gender },
          analyses: s.analyses.map(({ birads_category, confidence_score, analysis_status }) => ({
            birads_category,
            confidence_score,
            analysis_status,
          })),
        }
      }),
    )

    return {
      radiologist_id: userId,
      total_cases: cases.length,
      pending_cases: count('pending'),
      in_progress_cases: count('in_progress'),
      completed_cases: count('completed'),
      recent_cases: recent,
    }
  },
})
