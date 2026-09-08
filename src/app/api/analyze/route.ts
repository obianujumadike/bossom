import { createClient } from '@/lib/supabase/server'
import { api, log } from '@/lib/api/response'

/**
 * POST /api/analyze
 * Accepts { imageId, caseId } and runs AI analysis.
 * If GCLOUD_MODEL_ENDPOINT is not set, returns a mock BI-RADS result.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return api.unauthorized()

    const body = await request.json().catch(() => null)
    if (!body || !body.imageId || !body.caseId) {
      return api.badRequest('imageId and caseId are required')
    }

    const { imageId, caseId } = body
    log.info('POST /api/analyze', { userId: user.id, caseId, imageId })

    // Verify the case belongs to this user
    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('radiologist_id', user.id)
      .single()

    if (caseErr && caseErr.code !== 'PGRST116') {
      return api.serverError('Failed to verify case', caseErr, { userId: user.id, caseId, dbCode: caseErr.code })
    }
    if (!caseData) {
      log.warn('Analyze: case not found or access denied', { userId: user.id, caseId })
      return api.notFound('Case not found')
    }

    // Create pending analysis record
    const { data: analysis, error: insertErr } = await supabase
      .from('analyses')
      .insert({
        case_id: caseId,
        image_id: imageId,
        model_version: 'blossom-v1',
        analysis_status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr || !analysis) {
      return api.serverError('Failed to create analysis record', insertErr, {
        userId: user.id,
        caseId,
        imageId,
        dbCode: insertErr?.code,
        dbDetail: insertErr?.details,
      })
    }

    try {
      let result: {
        birads_category: number
        confidence_score: number
        malignancy_probability: number
        overall_assessment: string
        regions: Array<{
          roi_type: string
          coordinates: Record<string, number>
          confidence_score: number
          malignancy_probability: number
          size_mm: number | null
          characteristics: Record<string, string> | null
          clinical_significance: string
        }>
      }

      if (process.env.GCLOUD_MODEL_ENDPOINT) {
        // Fetch the image's public URL from storage
        const { data: imgData, error: imgErr } = await supabase
          .from('images')
          .select('file_path')
          .eq('id', imageId)
          .single()

        if (imgErr || !imgData?.file_path) {
          throw new Error(`Image not found: ${imgErr?.message ?? 'no file_path'}`)
        }

        const { data: urlData } = supabase.storage
          .from('mammograms')
          .getPublicUrl(imgData.file_path)

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (process.env.GCLOUD_API_KEY) headers['X-API-Key'] = process.env.GCLOUD_API_KEY

        const resp = await fetch(`${process.env.GCLOUD_MODEL_ENDPOINT}/analyze`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ image_url: urlData.publicUrl }),
        })
        if (!resp.ok) throw new Error(`AI service returned ${resp.status}`)

        const raw = await resp.json()
        result = {
          birads_category: raw.birads,
          confidence_score: raw.confidence,
          malignancy_probability: raw.malignancy_probability ?? 0,
          overall_assessment: raw.findings_text,
          regions: [],
        }
      } else if (process.env.NODE_ENV === 'production') {
        await supabase.from('analyses').update({ analysis_status: 'failed' }).eq('id', analysis.id)
        return api.serviceUnavailable('AI model endpoint is not configured. Contact your administrator.')
      } else {
        // Mock result for development only
        const categories = [1, 2, 3, 4]
        const birads = categories[Math.floor(Math.random() * categories.length)]
        const confidence = 0.75 + Math.random() * 0.2
        const malignancy = birads >= 4 ? 0.4 + Math.random() * 0.4 : Math.random() * 0.15
        const assessments: Record<number, string> = {
          1: 'Negative - No significant findings',
          2: 'Benign finding',
          3: 'Probably benign - Short interval follow-up suggested',
          4: 'Suspicious abnormality - Biopsy should be considered',
        }
        result = {
          birads_category: birads,
          confidence_score: Math.round(confidence * 100) / 100,
          malignancy_probability: Math.round(malignancy * 100) / 100,
          overall_assessment: assessments[birads],
          regions: birads >= 3
            ? [{
                roi_type: 'mass',
                coordinates: { x: 230, y: 180, width: 45, height: 40 },
                confidence_score: Math.round(confidence * 100) / 100,
                malignancy_probability: Math.round(malignancy * 100) / 100,
                size_mm: 8 + Math.round(Math.random() * 15),
                characteristics: { shape: 'irregular', margin: 'spiculated', density: 'high' },
                clinical_significance: birads >= 4 ? 'Requires biopsy' : 'Follow-up recommended',
              }]
            : [],
        }
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Persist results
      const { error: updateErr } = await supabase
        .from('analyses')
        .update({
          analysis_status: 'completed',
          birads_category: result.birads_category,
          confidence_score: result.confidence_score,
          malignancy_probability: result.malignancy_probability,
          overall_assessment: result.overall_assessment,
          completed_at: new Date().toISOString(),
        })
        .eq('id', analysis.id)

      if (updateErr) {
        log.warn('Failed to persist analysis results', {
          userId: user.id,
          analysisId: analysis.id,
          dbCode: updateErr.code,
          dbMessage: updateErr.message,
        })
      }

      if (result.regions?.length) {
        const { error: roiErr } = await supabase.from('regions_of_interest').insert(
          result.regions.map(r => ({
            analysis_id: analysis.id,
            roi_type: r.roi_type,
            coordinates: r.coordinates,
            confidence_score: r.confidence_score,
            malignancy_probability: r.malignancy_probability,
            size_mm: r.size_mm,
            characteristics: r.characteristics,
            clinical_significance: r.clinical_significance,
          }))
        )
        if (roiErr) {
          log.warn('Failed to save regions of interest', {
            userId: user.id,
            analysisId: analysis.id,
            dbCode: roiErr.code,
            dbMessage: roiErr.message,
          })
        }
      }

      log.info('Analysis completed', {
        userId: user.id,
        caseId,
        imageId,
        analysisId: analysis.id,
        birads: result.birads_category,
      })

      return api.ok({ analysisId: analysis.id, ...result })
    } catch (err) {
      const { error: failErr } = await supabase
        .from('analyses')
        .update({ analysis_status: 'failed' })
        .eq('id', analysis.id)

      if (failErr) {
        log.warn('Failed to mark analysis as failed', {
          userId: user.id,
          analysisId: analysis.id,
          dbCode: failErr.code,
        })
      }

      return api.serverError('Analysis failed', err, { userId: user.id, caseId, imageId, analysisId: analysis.id })
    }
  } catch (err) {
    return api.serverError('Unexpected error in POST /api/analyze', err)
  }
}
