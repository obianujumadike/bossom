import { createClient } from '@/lib/supabase/server'
import { api, log } from '@/lib/api/response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/cases/[id]/images — upload an image for a case
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return api.unauthorized()

    // Verify case ownership — distinguish "not found" from real DB errors
    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('radiologist_id', user.id)
      .single()

    if (caseErr && caseErr.code !== 'PGRST116') {
      return api.serverError('Failed to verify case ownership', caseErr, {
        userId: user.id,
        caseId,
        dbCode: caseErr.code,
      })
    }
    if (!caseData) {
      log.warn('Image upload: case not found or access denied', { userId: user.id, caseId })
      return api.notFound('Case not found')
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) return api.badRequest('Invalid form data')

    const file = formData.get('file') as File | null
    const laterality = formData.get('laterality') as string | null
    const viewPosition = formData.get('viewPosition') as string | null

    if (!file) return api.badRequest('No file provided')

    const allowedTypes = ['image/png', 'image/jpeg', 'image/dicom', 'application/dicom']
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.dcm')) {
      return api.badRequest('Invalid file type. Accepted: JPEG, PNG, DICOM')
    }

    if (file.size > 50 * 1024 * 1024) {
      return api.badRequest('File too large (max 50 MB)')
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `cases/${caseId}/${Date.now()}-${safeName}`

    log.info('Uploading image', { userId: user.id, caseId, fileName: file.name, fileSize: file.size, filePath })

    const { error: uploadErr } = await supabase.storage
      .from('mammograms')
      .upload(filePath, file, { contentType: file.type, upsert: false })

    if (uploadErr) {
      return api.serverError('Failed to upload file', uploadErr, { userId: user.id, caseId, filePath })
    }

    const { data: urlData } = supabase.storage.from('mammograms').getPublicUrl(filePath)

    const { data: image, error: dbErr } = await supabase
      .from('images')
      .insert({
        case_id: caseId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        laterality: (laterality as 'Left' | 'Right' | 'Bilateral') || null,
        view_position: viewPosition || null,
        upload_status: 'completed',
        is_primary: false,
      })
      .select()
      .single()

    if (dbErr || !image) {
      return api.serverError('Failed to save image record', dbErr, {
        userId: user.id,
        caseId,
        filePath,
        dbCode: dbErr?.code,
        dbDetail: dbErr?.details,
      })
    }

    // Mark first image as primary
    const { count, error: countErr } = await supabase
      .from('images')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)

    if (countErr) {
      log.warn('Failed to count images for primary check', { userId: user.id, caseId, imageId: image.id, dbCode: countErr.code })
    } else if (count === 1) {
      const { error: primaryErr } = await supabase
        .from('images')
        .update({ is_primary: true })
        .eq('id', image.id)
      if (primaryErr) {
        log.warn('Failed to mark image as primary', { userId: user.id, caseId, imageId: image.id, dbCode: primaryErr.code })
      }
    }

    // Update case status to in_progress
    const { error: statusErr } = await supabase
      .from('cases')
      .update({ status: 'in_progress' })
      .eq('id', caseId)
      .eq('status', 'pending')
    if (statusErr) {
      log.warn('Failed to update case status to in_progress', { userId: user.id, caseId, dbCode: statusErr.code })
    }

    log.info('Image uploaded', { userId: user.id, caseId, imageId: image.id })

    return api.created({ ...image, publicUrl: urlData.publicUrl }, 'Image uploaded successfully')
  } catch (err) {
    return api.serverError('Unexpected error in POST /api/cases/[id]/images', err)
  }
}

// GET /api/cases/[id]/images — list images for a case
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return api.unauthorized()

    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('radiologist_id', user.id)
      .single()

    if (caseErr && caseErr.code !== 'PGRST116') {
      return api.serverError('Failed to verify case ownership', caseErr, {
        userId: user.id,
        caseId,
        dbCode: caseErr.code,
      })
    }
    if (!caseData) {
      log.warn('Images list: case not found or access denied', { userId: user.id, caseId })
      return api.notFound('Case not found')
    }

    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })

    if (error) {
      return api.serverError('Failed to fetch images', error, { userId: user.id, caseId, dbCode: error.code })
    }

    const imagesWithUrls = (data || []).map(img => {
      const { data: urlData } = supabase.storage.from('mammograms').getPublicUrl(img.file_path)
      return { ...img, publicUrl: urlData.publicUrl }
    })

    return api.ok(imagesWithUrls)
  } catch (err) {
    return api.serverError('Unexpected error in GET /api/cases/[id]/images', err)
  }
}
