import { ConvexError, v } from 'convex/values'
import { action, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { requireOwnedCase, requireUserId } from './lib/session'
import { imageDeliveryUrl } from './lib/imageUrl'

// The whole analysis runs server-side in one action. Results are written by
// internal mutations only, so no client can submit or alter a BI-RADS score.
//
// Configuration (Convex env):
//   GCLOUD_MODEL_ENDPOINT  inference service base URL (POST {endpoint}/analyze)
//   GCLOUD_API_KEY         optional, sent as X-API-Key
//   ANALYSIS_MOCK=true     dev only: random results when no endpoint is set
// With neither set, analysis fails closed instead of inventing a result.

const MODEL_VERSION = 'bossom-v1'
const MODEL_TIMEOUT_MS = 120_000

type Region = {
  roi_type: string
  coordinates: Record<string, number>
  confidence_score: number
  malignancy_probability: number | null
  size_mm: number | null
  characteristics: Record<string, string> | null
  clinical_significance: string
}

type Result = {
  birads_category: number
  confidence_score: number
  malignancy_probability: number
  overall_assessment: string
  regions: Region[]
}

export const start = internalMutation({
  args: { caseId: v.string(), imageId: v.string() },
  handler: async (ctx, { caseId, imageId }) => {
    const userId = await requireUserId(ctx)
    const c = await requireOwnedCase(ctx, caseId, userId)
    const imgId = ctx.db.normalizeId('images', imageId)
    const image = imgId ? await ctx.db.get(imgId) : null
    if (!image || image.case_id !== c._id) throw new ConvexError('NOT_FOUND')

    const ts = new Date().toISOString()
    const analysisId = await ctx.db.insert('analyses', {
      case_id: c._id,
      image_id: image._id,
      model_version: MODEL_VERSION,
      analysis_status: 'processing',
      requested_by: userId,
      started_at: ts,
      created_at: ts,
      updated_at: ts,
    })
    return { analysisId, imageUrl: await imageDeliveryUrl(image) }
  },
})

export const complete = internalMutation({
  args: {
    analysisId: v.id('analyses'),
    source: v.string(),
    result: v.object({
      birads_category: v.number(),
      confidence_score: v.number(),
      malignancy_probability: v.number(),
      overall_assessment: v.string(),
      regions: v.array(v.any()),
    }),
  },
  handler: async (ctx, { analysisId, source, result }) => {
    const ts = new Date().toISOString()
    await ctx.db.patch(analysisId, {
      analysis_status: 'completed',
      source,
      birads_category: result.birads_category,
      confidence_score: result.confidence_score,
      malignancy_probability: result.malignancy_probability,
      overall_assessment: result.overall_assessment,
      completed_at: ts,
      updated_at: ts,
    })
    for (const r of result.regions as Region[]) {
      await ctx.db.insert('regions_of_interest', {
        analysis_id: analysisId,
        roi_type: r.roi_type,
        coordinates: r.coordinates,
        confidence_score: r.confidence_score,
        malignancy_probability: r.malignancy_probability ?? undefined,
        size_mm: r.size_mm ?? undefined,
        characteristics: r.characteristics ?? undefined,
        clinical_significance: r.clinical_significance,
        created_at: ts,
      })
    }
  },
})

export const fail = internalMutation({
  args: { analysisId: v.id('analyses'), reason: v.string() },
  handler: async (ctx, { analysisId, reason }) => {
    const ts = new Date().toISOString()
    await ctx.db.patch(analysisId, {
      analysis_status: 'failed',
      failure_reason: reason.slice(0, 500),
      completed_at: ts,
      updated_at: ts,
    })
  },
})

async function callModel(endpoint: string, imageUrl: string): Promise<Result> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.GCLOUD_API_KEY) headers['X-API-Key'] = process.env.GCLOUD_API_KEY

  const resp = await fetch(`${endpoint.replace(/\/$/, '')}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image_url: imageUrl }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`AI service returned ${resp.status}`)

  const raw = await resp.json()
  if (typeof raw.birads !== 'number' || typeof raw.confidence !== 'number') {
    throw new Error('AI service returned an unexpected payload')
  }
  return {
    birads_category: raw.birads,
    confidence_score: raw.confidence,
    malignancy_probability: typeof raw.malignancy_probability === 'number' ? raw.malignancy_probability : 0,
    overall_assessment: String(raw.findings_text ?? ''),
    regions: [],
  }
}

function mockResult(): Result {
  const birads = [1, 2, 3, 4][Math.floor(Math.random() * 4)]
  const confidence = Math.round((0.75 + Math.random() * 0.2) * 100) / 100
  const malignancy = Math.round((birads >= 4 ? 0.4 + Math.random() * 0.4 : Math.random() * 0.15) * 100) / 100
  const assessments: Record<number, string> = {
    1: 'Negative - No significant findings',
    2: 'Benign finding',
    3: 'Probably benign - Short interval follow-up suggested',
    4: 'Suspicious abnormality - Biopsy should be considered',
  }
  return {
    birads_category: birads,
    confidence_score: confidence,
    malignancy_probability: malignancy,
    overall_assessment: assessments[birads],
    regions:
      birads >= 3
        ? [
            {
              roi_type: 'mass',
              coordinates: { x: 230, y: 180, width: 45, height: 40 },
              confidence_score: confidence,
              malignancy_probability: malignancy,
              size_mm: 8 + Math.round(Math.random() * 15),
              characteristics: { shape: 'irregular', margin: 'spiculated', density: 'high' },
              clinical_significance: birads >= 4 ? 'Requires biopsy' : 'Follow-up recommended',
            },
          ]
        : [],
  }
}

/** POST /api/analyze */
export const run = action({
  args: { caseId: v.string(), imageId: v.string() },
  handler: async (ctx, args): Promise<{ analysisId: Id<'analyses'> } & Result> => {
    const { analysisId, imageUrl }: { analysisId: Id<'analyses'>; imageUrl: string | null } =
      await ctx.runMutation(internal.analyses.start, args)

    const endpoint = process.env.GCLOUD_MODEL_ENDPOINT
    const mock = !endpoint && process.env.ANALYSIS_MOCK === 'true'
    if (!endpoint && !mock) {
      await ctx.runMutation(internal.analyses.fail, { analysisId, reason: 'AI model endpoint is not configured' })
      throw new ConvexError('ANALYSIS_NOT_CONFIGURED')
    }

    let result: Result
    try {
      if (mock) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        result = mockResult()
      } else {
        if (!imageUrl) throw new Error('Image storage is not configured, so the model cannot fetch the image')
        result = await callModel(endpoint!, imageUrl)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error('Analysis failed', { analysisId, reason })
      await ctx.runMutation(internal.analyses.fail, { analysisId, reason })
      throw new ConvexError('ANALYSIS_FAILED')
    }

    await ctx.runMutation(internal.analyses.complete, { analysisId, source: mock ? 'mock' : 'model', result })
    return { analysisId, ...result }
  },
})
