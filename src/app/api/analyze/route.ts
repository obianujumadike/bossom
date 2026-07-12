import { createClient } from '@/lib/supabase/server'
import { api, log } from '@/lib/api/response'
import { predictBreastCancerRisk } from '@/lib/ml/risk-prediction'

/**
 * POST /api/analyze
 * Accepts { imageId, caseId } and runs breast cancer risk prediction.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return api.unauthorized()
    }

    const body = await request.json().catch(() => null)

    if (!body || !body.imageId || !body.caseId) {
      return api.badRequest('imageId and caseId are required')
    }

    const { imageId, caseId } = body

    log.info('POST /api/analyze risk prediction', {
      userId: user.id,
      caseId,
      imageId,
    })

    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('radiologist_id', user.id)
      .single()

    if (caseErr && caseErr.code !== 'PGRST116') {
      return api.serverError('Failed to verify case', caseErr, {
        userId: user.id,
        caseId,
        dbCode: caseErr.code,
      })
    }

    if (!caseData) {
      log.warn('Analyze: case not found or access denied', {
        userId: user.id,
        caseId,
      })

      return api.notFound('Case not found')
    }

    const { data: analysis, error: insertErr } = await supabase
      .from('analyses')
      .insert({
        case_id: caseId,
        image_id: imageId,
        model_version: 'mirai-mock-v1',
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
      const riskResult = await predictBreastCancerRisk(caseId)

      const { error: updateErr } = await supabase
        .from('analyses')
        .update({
          analysis_status: 'completed',
          model_version: `${riskResult.modelName}-${riskResult.modelVersion}`,
          overall_assessment: `${riskResult.riskCategory} breast cancer risk`,
          confidence_score: null,
          malignancy_probability: riskResult.fiveYearRisk,
          analysis_metadata: riskResult,
          completed_at: new Date().toISOString(),
        })
        .eq('id', analysis.id)

      if (updateErr) {
        log.warn('Failed to persist risk prediction results', {
          userId: user.id,
          analysisId: analysis.id,
          dbCode: updateErr.code,
          dbMessage: updateErr.message,
        })
      }

      log.info('Risk prediction completed', {
        userId: user.id,
        caseId,
        imageId,
        analysisId: analysis.id,
        fiveYearRisk: riskResult.fiveYearRisk,
        riskCategory: riskResult.riskCategory,
      })

      return api.ok({
        analysisId: analysis.id,
        ...riskResult,
      })
    } catch (err) {
      const { error: failErr } = await supabase
        .from('analyses')
        .update({
          analysis_status: 'failed',
        })
        .eq('id', analysis.id)

      if (failErr) {
        log.warn('Failed to mark risk prediction as failed', {
          userId: user.id,
          analysisId: analysis.id,
          dbCode: failErr.code,
          dbMessage: failErr.message,
        })
      }

      return api.serverError('Risk prediction failed', err, {
        userId: user.id,
        caseId,
        imageId,
        analysisId: analysis.id,
      })
    }
  } catch (err) {
    return api.serverError(
      'Unexpected error in POST /api/analyze',
      err,
    )
  }
}