import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

// Domain fields stay snake_case with ISO-string timestamps so the /api/* JSON
// contract the pages consume is unchanged, and rows migrated from Supabase
// keep their original timestamps. `legacy_id` is the Supabase UUID, kept for
// traceability and so the import can be re-run without duplicating rows.

export const caseStatus = v.union(
  v.literal('pending'),
  v.literal('in_progress'),
  v.literal('completed'),
  v.literal('cancelled'),
)
export const casePriority = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent'),
)
export const analysisStatus = v.union(
  v.literal('pending'),
  v.literal('processing'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('cancelled'),
)
export const laterality = v.union(v.literal('Left'), v.literal('Right'), v.literal('Bilateral'))
export const gender = v.union(v.literal('Female'), v.literal('Male'), v.literal('Other'))
export const breastDensity = v.union(v.literal('A'), v.literal('B'), v.literal('C'), v.literal('D'))
export const role = v.union(v.literal('radiologist'), v.literal('admin'))

export default defineSchema({
  ...authTables,

  // Convex Auth owns email / emailVerificationTime; the rest is the
  // radiologist profile that used to live in Supabase's public.users.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    full_name: v.optional(v.string()),
    medical_license_number: v.optional(v.string()),
    specialization: v.optional(v.string()),
    hospital_affiliation: v.optional(v.string()),
    phone_number: v.optional(v.string()),
    role: v.optional(role),
    is_active: v.optional(v.boolean()),
    created_at: v.optional(v.string()),
    updated_at: v.optional(v.string()),
    legacy_id: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_legacy_id', ['legacy_id']),

  patients: defineTable({
    patient_id: v.string(), // MRN as entered by the radiologist
    age: v.number(),
    gender: gender,
    date_of_birth: v.optional(v.string()),
    created_by: v.optional(v.id('users')),
    created_at: v.string(),
    updated_at: v.string(),
    legacy_id: v.optional(v.string()),
  })
    .index('by_creator_and_mrn', ['created_by', 'patient_id'])
    .index('by_legacy_id', ['legacy_id']),

  patient_clinical_history: defineTable({
    patient_id: v.id('patients'),
    clinical_notes: v.optional(v.string()),
    current_medications: v.optional(v.string()),
    previous_mammograms_results: v.optional(v.string()),
    risk_factors: v.optional(v.any()),
    created_at: v.string(),
    updated_at: v.string(),
    legacy_id: v.optional(v.string()),
  })
    .index('by_patient', ['patient_id'])
    .index('by_legacy_id', ['legacy_id']),

  cases: defineTable({
    case_number: v.string(),
    patient_id: v.id('patients'),
    radiologist_id: v.id('users'),
    status: caseStatus,
    priority: casePriority,
    clinical_indication: v.optional(v.string()),
    referring_physician: v.optional(v.string()),
    study_date: v.string(),
    study_type: v.string(),
    breast_density: v.optional(breastDensity),
    case_notes: v.optional(v.string()),
    is_urgent: v.boolean(),
    completed_at: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
    legacy_id: v.optional(v.string()),
  })
    .index('by_radiologist', ['radiologist_id', 'created_at'])
    .index('by_radiologist_and_status', ['radiologist_id', 'status'])
    .index('by_legacy_id', ['legacy_id']),

  // Image bytes live in Cloudinary as `authenticated` assets; only signed
  // URLs ever leave the server.
  images: defineTable({
    case_id: v.id('cases'),
    file_name: v.string(),
    file_size: v.number(),
    file_type: v.string(),
    cloudinary_public_id: v.string(),
    cloudinary_version: v.number(),
    cloudinary_resource_type: v.string(),
    cloudinary_format: v.optional(v.string()),
    laterality: v.optional(laterality),
    view_position: v.optional(v.string()),
    upload_status: v.union(v.literal('uploading'), v.literal('completed'), v.literal('failed')),
    is_primary: v.boolean(),
    uploaded_by: v.optional(v.id('users')),
    created_at: v.string(),
    updated_at: v.string(),
    legacy_id: v.optional(v.string()),
    legacy_file_path: v.optional(v.string()),
  })
    .index('by_case', ['case_id', 'created_at'])
    .index('by_legacy_id', ['legacy_id']),

  analyses: defineTable({
    case_id: v.id('cases'),
    image_id: v.id('images'),
    model_version: v.string(),
    analysis_status: analysisStatus,
    overall_assessment: v.optional(v.string()),
    confidence_score: v.optional(v.number()),
    birads_category: v.optional(v.number()),
    malignancy_probability: v.optional(v.number()),
    failure_reason: v.optional(v.string()),
    // 'mock' | 'model' — so a result can always be traced to what produced it
    source: v.optional(v.string()),
    requested_by: v.optional(v.id('users')),
    started_at: v.optional(v.string()),
    completed_at: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
    legacy_id: v.optional(v.string()),
  })
    .index('by_case', ['case_id', 'created_at'])
    .index('by_legacy_id', ['legacy_id']),

  regions_of_interest: defineTable({
    analysis_id: v.id('analyses'),
    roi_type: v.string(),
    coordinates: v.any(),
    confidence_score: v.number(),
    malignancy_probability: v.optional(v.number()),
    size_mm: v.optional(v.number()),
    characteristics: v.optional(v.any()),
    clinical_significance: v.optional(v.string()),
    created_at: v.string(),
    legacy_id: v.optional(v.string()),
  })
    .index('by_analysis', ['analysis_id'])
    .index('by_legacy_id', ['legacy_id']),
})
