import { v } from 'convex/values'
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server'
import type { Id, TableNames } from './_generated/dataModel'
import { normalizeEmail, PASSWORD_PROVIDER_ID } from './lib/rules'

// Import side of the Supabase → Convex migration (scripts/migrate-from-supabase.ts).
// Internal only: callable from the CLI with deployment credentials, never
// from a browser. Every row carries its Supabase UUID as `legacy_id`, so
// re-running a batch skips rows already imported instead of duplicating them.
// Foreign keys arrive as Supabase UUIDs and are resolved here.

type Row = Record<string, any>
type Report = { inserted: number; skipped: number; problems: string[] }

const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : undefined)
const iso = (x: unknown, fallback: string) => (typeof x === 'string' && x ? new Date(x).toISOString() : fallback)
const oneOf = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(x as T) ? (x as T) : fallback
const maybeOneOf = <T extends string>(x: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(x as T) ? (x as T) : undefined
const json = (x: unknown) => (x === null || x === undefined ? undefined : x)

async function byLegacy<T extends TableNames>(ctx: MutationCtx, table: T, legacyId: unknown): Promise<Id<T> | null> {
  if (typeof legacyId !== 'string') return null
  const doc = await ctx.db
    .query(table)
    .withIndex('by_legacy_id' as any, (q: any) => q.eq('legacy_id', legacyId))
    .first()
  return (doc?._id as Id<T>) ?? null
}

const rows = { rows: v.array(v.any()) }

export const importUsers = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      const email = normalizeEmail(r.email)
      if (!email) {
        report.problems.push(`user ${r.id}: no email, skipped`)
        continue
      }
      const existingUserId = await byLegacy(ctx, 'users', r.id)
      if (existingUserId) {
        // A first run without SUPABASE_ACCESS_TOKEN imports users with no
        // password; a later run with it attaches the hash.
        const account = await ctx.db
          .query('authAccounts')
          .withIndex('userIdAndProvider', q => q.eq('userId', existingUserId).eq('provider', PASSWORD_PROVIDER_ID))
          .unique()
        if (account && !account.secret && str(r.password_hash)) {
          await ctx.db.patch(account._id, { secret: str(r.password_hash) })
          report.problems.push(`user ${r.id}: password hash attached on re-run`)
        }
        report.skipped++
        continue
      }
      const existingAccount = await ctx.db
        .query('authAccounts')
        .withIndex('providerAndAccountId', q => q.eq('provider', PASSWORD_PROVIDER_ID).eq('providerAccountId', email))
        .unique()
      if (existingAccount) {
        // The person signed up on Convex before the import ran. Adopt that
        // account (so their Supabase cases attach to it) only when both systems
        // proved they own the mailbox; otherwise anyone could claim another
        // radiologist's patient data by registering their address first.
        // Login and password are never touched.
        const user = await ctx.db.get(existingAccount.userId)
        const ownsMailbox = existingAccount.emailVerified === email && !!r.email_confirmed_at
        if (!user || user.legacy_id || !ownsMailbox) {
          report.problems.push(
            `user ${r.id}: ${email} already has a Convex account, not linked (${!user ? 'user missing' : user.legacy_id ? 'already linked to another Supabase user' : 'email not verified on both systems'})`,
          )
          continue
        }
        const fill = <K extends keyof typeof user>(key: K, value: (typeof user)[K] | undefined) =>
          user[key] === undefined && value !== undefined ? { [key]: value } : {}
        await ctx.db.patch(user._id, {
          legacy_id: r.id,
          ...fill('full_name', str(r.full_name)),
          ...fill('name', str(r.full_name)),
          ...fill('medical_license_number', str(r.medical_license_number)),
          ...fill('hospital_affiliation', str(r.hospital_affiliation)),
          ...fill('phone_number', str(r.phone_number)),
        })
        report.problems.push(`user ${r.id}: linked to the existing Convex account for ${email}; its login is unchanged`)
        report.inserted++
        continue
      }

      const created = iso(r.created_at, new Date().toISOString())
      const verifiedAt = r.email_confirmed_at ? new Date(r.email_confirmed_at).getTime() : undefined
      const fullName = str(r.full_name)
      const userId = await ctx.db.insert('users', {
        email,
        emailVerificationTime: verifiedAt,
        name: fullName,
        full_name: fullName,
        medical_license_number: str(r.medical_license_number),
        specialization: str(r.specialization) ?? 'Radiology',
        hospital_affiliation: str(r.hospital_affiliation),
        phone_number: str(r.phone_number),
        role: oneOf(r.role, ['radiologist', 'admin'] as const, 'radiologist'),
        is_active: r.is_active !== false,
        created_at: created,
        updated_at: iso(r.updated_at, created),
        legacy_id: r.id,
      })
      await ctx.db.insert('authAccounts', {
        userId,
        provider: PASSWORD_PROVIDER_ID,
        providerAccountId: email,
        // Supabase bcrypt hash when available; without one the person sets a
        // new password through "Forgot password".
        secret: str(r.password_hash),
        emailVerified: verifiedAt !== undefined ? email : undefined,
      })
      if (!str(r.password_hash)) report.problems.push(`user ${r.id}: no password hash, must reset password`)
      report.inserted++
    }
    return report
  },
})

export const importPatients = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      if (await byLegacy(ctx, 'patients', r.id)) {
        report.skipped++
        continue
      }
      const created = iso(r.created_at, new Date().toISOString())
      await ctx.db.insert('patients', {
        patient_id: str(r.patient_id) ?? String(r.id),
        age: num(r.age) ?? 0,
        gender: oneOf(r.gender, ['Female', 'Male', 'Other'] as const, 'Female'),
        date_of_birth: str(r.date_of_birth),
        created_by: (await byLegacy(ctx, 'users', r.created_by)) ?? undefined,
        created_at: created,
        updated_at: iso(r.updated_at, created),
        legacy_id: r.id,
      })
      report.inserted++
    }
    return report
  },
})

export const importClinicalHistory = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      if (await byLegacy(ctx, 'patient_clinical_history', r.id)) {
        report.skipped++
        continue
      }
      const patientId = await byLegacy(ctx, 'patients', r.patient_id)
      if (!patientId) {
        report.problems.push(`clinical history ${r.id}: patient ${r.patient_id} not found`)
        continue
      }
      const created = iso(r.created_at, new Date().toISOString())
      await ctx.db.insert('patient_clinical_history', {
        patient_id: patientId,
        clinical_notes: str(r.clinical_notes),
        current_medications: str(r.current_medications),
        previous_mammograms_results: str(r.previous_mammograms_results),
        risk_factors: json(r.risk_factors),
        created_at: created,
        updated_at: iso(r.updated_at, created),
        legacy_id: r.id,
      })
      report.inserted++
    }
    return report
  },
})

export const importCases = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      if (await byLegacy(ctx, 'cases', r.id)) {
        report.skipped++
        continue
      }
      const patientId = await byLegacy(ctx, 'patients', r.patient_id)
      const radiologistId = await byLegacy(ctx, 'users', r.radiologist_id)
      if (!patientId || !radiologistId) {
        report.problems.push(`case ${r.case_number ?? r.id}: ${!patientId ? 'patient' : 'radiologist'} not found`)
        continue
      }
      const created = iso(r.created_at, new Date().toISOString())
      await ctx.db.insert('cases', {
        case_number: str(r.case_number) ?? `BLS-${String(r.id).slice(0, 8).toUpperCase()}`,
        patient_id: patientId,
        radiologist_id: radiologistId,
        status: oneOf(r.status, ['pending', 'in_progress', 'completed', 'cancelled'] as const, 'pending'),
        priority: oneOf(r.priority, ['low', 'normal', 'high', 'urgent'] as const, 'normal'),
        clinical_indication: str(r.clinical_indication),
        referring_physician: str(r.referring_physician),
        study_date: str(r.study_date) ?? created.split('T')[0],
        study_type: str(r.study_type) ?? 'Screening Mammogram',
        breast_density: maybeOneOf(r.breast_density, ['A', 'B', 'C', 'D'] as const),
        case_notes: str(r.case_notes),
        is_urgent: r.is_urgent === true,
        completed_at: r.completed_at ? iso(r.completed_at, created) : undefined,
        created_at: created,
        updated_at: iso(r.updated_at, created),
        legacy_id: r.id,
      })
      report.inserted++
    }
    return report
  },
})

/** Images arrive already copied to Cloudinary; the row carries the upload result. */
export const importImages = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      if (await byLegacy(ctx, 'images', r.id)) {
        report.skipped++
        continue
      }
      const caseId = await byLegacy(ctx, 'cases', r.case_id)
      if (!caseId || !r.cloudinary) {
        report.problems.push(`image ${r.id}: ${!caseId ? 'case not found' : 'file was not copied to Cloudinary'}`)
        continue
      }
      const created = iso(r.created_at, new Date().toISOString())
      await ctx.db.insert('images', {
        case_id: caseId,
        file_name: str(r.file_name) ?? 'image',
        file_size: num(r.file_size) ?? r.cloudinary.bytes ?? 0,
        file_type: str(r.file_type) ?? 'application/octet-stream',
        cloudinary_public_id: r.cloudinary.public_id,
        cloudinary_version: r.cloudinary.version,
        cloudinary_resource_type: r.cloudinary.resource_type,
        cloudinary_format: str(r.cloudinary.format),
        laterality: maybeOneOf(r.laterality, ['Left', 'Right', 'Bilateral'] as const),
        view_position: str(r.view_position),
        upload_status: oneOf(r.upload_status, ['uploading', 'completed', 'failed'] as const, 'completed'),
        is_primary: r.is_primary === true,
        created_at: created,
        updated_at: iso(r.updated_at, created),
        legacy_id: r.id,
        legacy_file_path: str(r.file_path),
      })
      report.inserted++
    }
    return report
  },
})

export const importAnalyses = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      if (await byLegacy(ctx, 'analyses', r.id)) {
        report.skipped++
        continue
      }
      const caseId = await byLegacy(ctx, 'cases', r.case_id)
      const imageId = await byLegacy(ctx, 'images', r.image_id)
      if (!caseId || !imageId) {
        report.problems.push(`analysis ${r.id}: ${!caseId ? 'case' : 'image'} not found`)
        continue
      }
      const created = iso(r.created_at, new Date().toISOString())
      const status = oneOf(r.analysis_status, ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const, 'failed')
      // Runs left pending/processing in Supabase were interrupted; nothing can
      // finish them now, so they arrive as failed rather than spinning forever.
      const interrupted = status === 'pending' || status === 'processing'
      await ctx.db.insert('analyses', {
        case_id: caseId,
        image_id: imageId,
        model_version: str(r.model_version) ?? 'bossom-v1',
        analysis_status: interrupted ? 'failed' : status,
        failure_reason: interrupted ? `Interrupted while ${status} in Supabase; imported as failed` : undefined,
        overall_assessment: str(r.overall_assessment),
        confidence_score: num(r.confidence_score),
        birads_category: num(r.birads_category),
        malignancy_probability: num(r.malignancy_probability),
        source: 'supabase-import',
        started_at: r.started_at ? iso(r.started_at, created) : undefined,
        completed_at: r.completed_at ? iso(r.completed_at, created) : undefined,
        created_at: created,
        updated_at: iso(r.updated_at, created),
        legacy_id: r.id,
      })
      report.inserted++
    }
    return report
  },
})

export const importRegions = internalMutation({
  args: rows,
  handler: async (ctx, { rows }): Promise<Report> => {
    const report: Report = { inserted: 0, skipped: 0, problems: [] }
    for (const r of rows as Row[]) {
      if (await byLegacy(ctx, 'regions_of_interest', r.id)) {
        report.skipped++
        continue
      }
      const analysisId = await byLegacy(ctx, 'analyses', r.analysis_id)
      if (!analysisId) {
        report.problems.push(`region ${r.id}: analysis ${r.analysis_id} not found`)
        continue
      }
      await ctx.db.insert('regions_of_interest', {
        analysis_id: analysisId,
        roi_type: str(r.roi_type) ?? 'unknown',
        coordinates: json(r.coordinates) ?? {},
        confidence_score: num(r.confidence_score) ?? 0,
        malignancy_probability: num(r.malignancy_probability),
        size_mm: num(r.size_mm),
        characteristics: json(r.characteristics),
        clinical_significance: str(r.clinical_significance),
        created_at: iso(r.created_at, new Date().toISOString()),
        legacy_id: r.id,
      })
      report.inserted++
    }
    return report
  },
})

/** Legacy image ids already imported, so the script skips re-copying their files. */
export const importedImageLegacyIds = internalQuery({
  args: {},
  handler: async ctx => {
    const images = await ctx.db.query('images').collect()
    return images.flatMap(i => (i.legacy_id ? [i.legacy_id] : []))
  },
})
