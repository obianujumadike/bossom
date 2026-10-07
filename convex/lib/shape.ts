import type { Doc } from '../_generated/dataModel'

// Shapes Convex documents into the JSON the pages were built against when
// the API was backed by Supabase: `id` instead of `_id`, and `null` (not a
// missing key) for empty columns, because the pages test `!== null`.

const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value)

export function shapePatient(p: Doc<'patients'>) {
  return {
    id: p._id,
    patient_id: p.patient_id,
    age: p.age,
    gender: p.gender,
    date_of_birth: orNull(p.date_of_birth),
    created_by: orNull(p.created_by),
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

export function shapeCase(c: Doc<'cases'>) {
  return {
    id: c._id,
    case_number: c.case_number,
    patient_id: c.patient_id,
    radiologist_id: c.radiologist_id,
    status: c.status,
    priority: c.priority,
    clinical_indication: orNull(c.clinical_indication),
    referring_physician: orNull(c.referring_physician),
    study_date: c.study_date,
    study_type: c.study_type,
    breast_density: orNull(c.breast_density),
    case_notes: orNull(c.case_notes),
    is_urgent: c.is_urgent,
    completed_at: orNull(c.completed_at),
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

export function shapeImage(i: Doc<'images'>, publicUrl: string | null) {
  return {
    id: i._id,
    case_id: i.case_id,
    file_name: i.file_name,
    file_path: i.cloudinary_public_id,
    file_size: i.file_size,
    file_type: i.file_type,
    laterality: orNull(i.laterality),
    view_position: orNull(i.view_position),
    upload_status: i.upload_status,
    is_primary: i.is_primary,
    created_at: i.created_at,
    updated_at: i.updated_at,
    publicUrl,
  }
}

export function shapeAnalysis(a: Doc<'analyses'>) {
  return {
    id: a._id,
    case_id: a.case_id,
    image_id: a.image_id,
    model_version: a.model_version,
    analysis_status: a.analysis_status,
    overall_assessment: orNull(a.overall_assessment),
    confidence_score: orNull(a.confidence_score),
    birads_category: orNull(a.birads_category),
    malignancy_probability: orNull(a.malignancy_probability),
    source: orNull(a.source),
    started_at: orNull(a.started_at),
    completed_at: orNull(a.completed_at),
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

export function shapeRegion(r: Doc<'regions_of_interest'>) {
  return {
    id: r._id,
    analysis_id: r.analysis_id,
    roi_type: r.roi_type,
    coordinates: r.coordinates,
    confidence_score: r.confidence_score,
    malignancy_probability: orNull(r.malignancy_probability),
    size_mm: orNull(r.size_mm),
    characteristics: orNull(r.characteristics),
    clinical_significance: orNull(r.clinical_significance),
    created_at: r.created_at,
  }
}

export function shapeProfile(u: Doc<'users'>) {
  return {
    id: u._id,
    email: u.email ?? '',
    full_name: u.full_name ?? '',
    medical_license_number: u.medical_license_number ?? '',
    specialization: u.specialization ?? 'Radiology',
    hospital_affiliation: orNull(u.hospital_affiliation),
    phone_number: orNull(u.phone_number),
    role: u.role ?? 'radiologist',
    is_verified: u.emailVerificationTime !== undefined,
    created_at: u.created_at ?? new Date(u._creationTime).toISOString(),
    updated_at: u.updated_at ?? new Date(u._creationTime).toISOString(),
  }
}
