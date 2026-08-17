import { createClient } from '@/lib/supabase/server'
import { api, log } from '@/lib/api/response'

interface RouteParams {params: Promise<{ id: string }>}

type Laterality = 'Left' | 'Right' | 'Bilateral'
interface CreateImageBody {
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  laterality?: Laterality | null
  viewPosition?: string | null
}

// The large file has already been uploaded directly to Supabase Storage. This route only creates the corresponding database record.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: caseId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return api.unauthorized()
    }

    // Confirm that the case belongs to the logged-in radiologist.
    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('radiologist_id', user.id)
      .single()

    if (caseErr && caseErr.code !== 'PGRST116') {
      return api.serverError(
        'Failed to verify case ownership',
        caseErr,
        {
          userId: user.id,
          caseId,
          dbCode: caseErr.code,
        }
      )
    }

    if (!caseData) {
      log.warn('Image registration: case not found or access denied', {
        userId: user.id,
        caseId,
      })

      return api.notFound('Case not found')
    }

    const body = (await request.json().catch(() => null)) as
      | CreateImageBody
      | null

    if (
      !body ||
      typeof body.fileName !== 'string' ||
      typeof body.filePath !== 'string' ||
      typeof body.fileSize !== 'number' ||
      typeof body.fileType !== 'string'
    ) {
      return api.badRequest(
        'fileName, filePath, fileSize and fileType are required'
      )
    }

    const {
      fileName,
      filePath,
      fileSize,
      fileType,
      laterality = null,
      viewPosition = null,
    } = body

    if (!fileName.trim()) {
      return api.badRequest('fileName is required')
    }

    if (fileSize <= 0) {
      return api.badRequest('Invalid file size')
    }

    if (fileSize > 50 * 1024 * 1024) {
      return api.badRequest('File too large (max 50 MB)')
    }

    // Prevent this case from registering a file belonging to another case.
    const expectedPathPrefix = `cases/${caseId}/`

    if (!filePath.startsWith(expectedPathPrefix)) {
      return api.badRequest('Invalid storage file path')
    }

    const allowedExtensions =
      /\.(dcm|dicom|jpg|jpeg|png|tif|tiff)$/i

    const allowedTypes = [
      'application/dicom',
      'image/dicom',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ]

    if (
      !allowedTypes.includes(fileType) &&
      !allowedExtensions.test(fileName)
    ) {
      return api.badRequest(
        'Invalid file type. Accepted: JPEG, PNG, TIFF and DICOM'
      )
    }

    const allowedLaterality: Laterality[] = [
      'Left',
      'Right',
      'Bilateral',
    ]

    if (
      laterality !== null &&
      !allowedLaterality.includes(laterality)
    ) {
      return api.badRequest('Invalid laterality')
    }

    log.info('Creating image database record', {
      userId: user.id,
      caseId,
      fileName,
      fileSize,
      filePath,
      laterality,
      viewPosition,
    })

    const { data: image, error: dbErr } = await supabase
      .from('images')
      .insert({
        case_id: caseId,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        file_type: fileType,
        laterality,
        view_position: viewPosition,
        upload_status: 'completed',
        is_primary: false,
      })
      .select()
      .single()

    if (dbErr || !image) {
      // If saving the image details to the database fails, remove the uploaded file from Storage so it is not left there without a matching image record.
      const { error: cleanupErr } = await supabase.storage
        .from('mammograms')
        .remove([filePath])

      if (cleanupErr) {
        log.warn('Failed to remove unregistered storage file', {
          userId: user.id,
          caseId,
          filePath,
          storageMessage: cleanupErr.message,
        })
      }

      return api.serverError(
        'Failed to save image record',
        dbErr,
        {
          userId: user.id,
          caseId,
          filePath,
          dbCode: dbErr?.code,
          dbDetail: dbErr?.details,
        }
      )
    }

    // Mark the first image uploaded for this case as the primary image.
    const { count, error: countErr } = await supabase
      .from('images')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('case_id', caseId)

    if (countErr) {
      log.warn('Failed to count images for primary check', {
        userId: user.id,
        caseId,
        imageId: image.id,
        dbCode: countErr.code,
      })
    } else if (count === 1) {
      const { error: primaryErr } = await supabase
        .from('images')
        .update({
          is_primary: true,
        })
        .eq('id', image.id)

      if (primaryErr) {
        log.warn('Failed to mark image as primary', {
          userId: user.id,
          caseId,
          imageId: image.id,
          dbCode: primaryErr.code,
        })
      }
    }

    // Move a pending case to in_progress after its first image upload.
    const { error: statusErr } = await supabase.from('cases').update({status: 'in_progress',}).eq('id', caseId).eq('status', 'pending')

    if (statusErr) {
      log.warn('Failed to update case status to in_progress', {
        userId: user.id,
        caseId,
        dbCode: statusErr.code,
      })
    }

    const { data: urlData } = supabase.storage
      .from('mammograms')
      .getPublicUrl(filePath)

    log.info('Image record created', {
      userId: user.id,
      caseId,
      imageId: image.id,
    })

    return api.created(
      {
        ...image,
        publicUrl: urlData.publicUrl,
      },
      'Image uploaded successfully'
    )
  } catch (err) {
    return api.serverError(
      'Unexpected error in POST /api/cases/[id]/images',
      err
    )
  }
}


// Lists all images belonging to a case.
export async function GET( _request: Request,{ params }: RouteParams) {
  try {
    const { id: caseId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return api.unauthorized()
    }

    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('radiologist_id', user.id)
      .single()

    if (caseErr && caseErr.code !== 'PGRST116') {
      return api.serverError(
        'Failed to verify case ownership',
        caseErr,
        {
          userId: user.id,
          caseId,
          dbCode: caseErr.code,
        }
      )
    }

    if (!caseData) {
      log.warn('Images list: case not found or access denied', {
        userId: user.id,
        caseId,
      })

      return api.notFound('Case not found')
    }

    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', {
        ascending: true,
      })

    if (error) {
      return api.serverError(
        'Failed to fetch images',
        error,
        {
          userId: user.id,
          caseId,
          dbCode: error.code,
        }
      )
    }

    const imagesWithUrls = (data || []).map((image) => {
      const { data: urlData } = supabase.storage
        .from('mammograms')
        .getPublicUrl(image.file_path)

      return {
        ...image,
        publicUrl: urlData.publicUrl,
      }
    })

    return api.ok(imagesWithUrls)
  } catch (err) {
    return api.serverError(
      'Unexpected error in GET /api/cases/[id]/images',
      err
    )
  }
}