'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-toastify'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { 
  FaArrowLeft, 
  FaExpand, 
  FaCompress, 
  FaSearchPlus, 
  FaSearchMinus,
  FaPlay,
  FaExclamationTriangle,
  FaEye,
  FaSpinner,
  FaCheckCircle,
  FaTimes
} from 'react-icons/fa'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'

interface CaseData {
  id: string
  case_number: string
  status: string
  priority: string
  study_date: string | null
  study_type: string | null
  breast_density: string | null
  referring_physician: string | null
  clinical_indication: string | null
  is_urgent: boolean
  patients: { patient_id: string; age: number; gender: string } | null
  images: Array<{
    id: string
    file_name: string
    file_path: string
    laterality: string | null
    view_position: string | null
    publicUrl?: string
  }>
  analyses: Array<{
    id: string
    birads_category: number | null
    confidence_score: number | null
    malignancy_probability: number | null
    overall_assessment: string | null
    analysis_status: string
    started_at: string | null
    regions_of_interest: Array<{
      id: string
      roi_type: string
      coordinates: Record<string, number>
      confidence_score: number
      malignancy_probability: number | null
      size_mm: number | null
      characteristics: Record<string, string> | null
      clinical_significance: string | null
    }>
  }>
}

export default function AnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [rerunConfirm, setRerunConfirm] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [nextStepsModal, setNextStepsModal] = useState(false)

  useEffect(() => {
    fetch(`/api/cases/${params.id}`)
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setCaseData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id, router])

  const runAnalysis = async (imageId: string) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, caseId: params.id }),
      })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Analysis failed')
      const { data: analysisResult } = await res.json()
      // Inject result directly into state — no re-fetch needed
      const newAnalysis = {
        id: analysisResult.analysisId,
        birads_category: analysisResult.birads_category,
        confidence_score: analysisResult.confidence_score,
        malignancy_probability: analysisResult.malignancy_probability,
        overall_assessment: analysisResult.overall_assessment,
        analysis_status: 'completed',
        started_at: new Date().toISOString(),
        regions_of_interest: [],
      }
      setCaseData(prev => prev ? { ...prev, analyses: [...(prev.analyses ?? []), newAnalysis] } : prev)
      setActiveAnalysisId(analysisResult.analysisId)
      toast.success('Analysis completed!')
    } catch {
      toast.error('Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const completedAnalyses = caseData?.analyses?.filter(a => a.analysis_status === 'completed') ?? []
  const latestAnalysis =
    (activeAnalysisId ? completedAnalyses.find(a => a.id === activeAnalysisId) : null) ??
    completedAnalyses.sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? '')).at(-1)
  const failedAnalysis = !latestAnalysis && caseData?.analyses?.some(a => a.analysis_status === 'failed')
  const rois = latestAnalysis?.regions_of_interest ?? []
  const selectedImage = caseData?.images?.[selectedImageIdx]

  const getBiradsColor = (score: number | null) => {
    if (!score) return 'text-gray-600 bg-gray-100'
    if (score <= 2) return 'text-green-600 bg-green-100'
    if (score === 3) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getROIColor = (prob: number | null) => {
    if (!prob) return 'border-blue-500 bg-blue-500/20'
    if (prob >= 0.5) return 'border-red-500 bg-red-500/20'
    if (prob >= 0.2) return 'border-yellow-500 bg-yellow-500/20'
    return 'border-green-500 bg-green-500/20'
  }

  const getNextSteps = (birads: number | null) => {
    if (!birads) return null
    if (birads <= 2) return {
      icon: '✅',
      title: 'Routine Follow-Up',
      color: 'green',
      heading: 'No immediate action required.',
      steps: [
        'Schedule routine mammogram in 1–2 years.',
        'Advise patient to perform regular self-examinations.',
        'Document findings in patient record.',
      ],
    }
    if (birads === 3) return {
      icon: '🔁',
      title: 'Short-Interval Follow-Up',
      color: 'yellow',
      heading: 'Benign appearance — close monitoring recommended.',
      steps: [
        'Schedule 6-month follow-up mammogram.',
        'Correlate with any prior imaging if available.',
        'Reassess at next appointment.',
      ],
    }
    if (birads === 4) return {
      icon: '⚠️',
      title: 'Tissue Biopsy Recommended',
      color: 'orange',
      heading: 'Suspicious abnormality detected.',
      steps: [
        'Refer patient for tissue biopsy.',
        'Expedite appointment within 2 weeks.',
        'Notify referring physician of findings.',
        'Document recommendation in patient record.',
      ],
    }
    return {
      icon: '🚨',
      title: 'Urgent — Highly Suspicious',
      color: 'red',
      heading: 'Highly suggestive of malignancy.',
      steps: [
        'Arrange urgent specialist referral.',
        'Contact patient within 24 hours.',
        'Expedite biopsy and oncology consultation.',
        'Notify referring physician immediately.',
      ],
    }
  }

  const markAsComplete = async () => {
    if (!latestAnalysis) {
      toast.error('Run AI analysis before marking as complete.')
      return
    }
    setCompleting(true)
    try {
      const res = await fetch(`/api/cases/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to update case')
      setCaseData(prev => prev ? { ...prev, status: 'completed' } : prev)
      setNextStepsModal(true)
    } catch {
      toast.error('Failed to mark case as complete. Please try again.')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bossom-pink-600"></div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Case not found</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaArrowLeft className="w-4 h-4" />
              </button>
              <BossomLogo size="sm" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">{caseData.case_number} - AI Analysis</h1>
                <p className="text-sm text-gray-600">
                  Patient: {caseData.patients?.patient_id ?? 'N/A'} • Age: {caseData.patients?.age ?? 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {latestAnalysis && caseData.status !== 'completed' && (
                <button
                  onClick={markAsComplete}
                  disabled={completing}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-70"
                >
                  {completing
                    ? <><FaSpinner className="w-4 h-4 animate-spin" /> Saving...</>
                    : <><FaCheckCircle className="w-4 h-4" /> Mark as Complete</>}
                </button>
              )}
              {caseData.status === 'completed' && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                  <FaCheckCircle className="w-3.5 h-3.5" /> Completed
                </span>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Analysis Results */}
        {!isFullscreen && <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Overall Assessment */}
          <div className="p-6 border-b border-gray-200">
            {latestAnalysis ? (
              <div>
                <div className="text-center mb-4">
                  <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold ${getBiradsColor(latestAnalysis.birads_category)}`}>
                    BI-RADS {latestAnalysis.birads_category ?? '?'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">
                      {latestAnalysis.confidence_score != null ? `${Math.round(latestAnalysis.confidence_score * 100)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Confidence</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${
                    (latestAnalysis.malignancy_probability ?? 0) >= 0.5
                      ? 'bg-red-50'
                      : (latestAnalysis.malignancy_probability ?? 0) >= 0.2
                      ? 'bg-yellow-50'
                      : 'bg-green-50'
                  }`}>
                    <div className={`text-xl font-bold ${
                      (latestAnalysis.malignancy_probability ?? 0) >= 0.5
                        ? 'text-red-700'
                        : (latestAnalysis.malignancy_probability ?? 0) >= 0.2
                        ? 'text-yellow-700'
                        : 'text-green-700'
                    }`}>
                      {latestAnalysis.malignancy_probability != null ? `${Math.round(latestAnalysis.malignancy_probability * 100)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Malignancy</div>
                  </div>
                </div>
                {latestAnalysis.overall_assessment && (
                  <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    <div className="font-medium text-gray-500 text-xs uppercase tracking-wide mb-1">Assessment</div>
                    <div>{latestAnalysis.overall_assessment}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                {failedAnalysis && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
                    <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                      <FaExclamationTriangle className="w-4 h-4 flex-shrink-0" />
                      Previous analysis failed
                    </div>
                    <p className="text-red-600 text-xs mt-1">Click below to retry.</p>
                  </div>
                )}
                <p className="text-gray-500 mb-4">{failedAnalysis ? 'Analysis did not complete' : 'No analysis results yet'}</p>
                {caseData.images.length > 0 && (
                  <button
                    onClick={() => runAnalysis(caseData.images[0].id)}
                    disabled={analyzing}
                    className={`${componentStyles.button.primary} flex items-center gap-2 mx-auto`}
                  >
                    {analyzing ? (
                      <><FaSpinner className="w-4 h-4 animate-spin" /> Analyzing...</>
                    ) : (
                      <><FaPlay className="w-4 h-4" /> {failedAnalysis ? 'Retry Analysis' : 'Run AI Analysis'}</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Case Info */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              Case Info
              {caseData.is_urgent && (
                <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">URGENT</span>
              )}
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Patient', value: caseData.patients?.patient_id },
                { label: 'Age / Sex', value: caseData.patients ? `${caseData.patients.age} yr • ${caseData.patients.gender}` : null },
                { label: 'Study', value: caseData.study_type },
                { label: 'Study Date', value: caseData.study_date ? new Date(caseData.study_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
                { label: 'Referring', value: caseData.referring_physician },
                { label: 'Density', value: caseData.breast_density },
                { label: 'Indication', value: caseData.clinical_indication },
                { label: 'Priority', value: caseData.priority ? caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1) : null },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">{label}</span>
                    <span className="text-gray-900 text-right">{value}</span>
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Image Selection */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Images ({caseData.images.length})</h3>
            {caseData.images.length === 0 ? (
              <p className="text-sm text-gray-500">No images uploaded yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {caseData.images.map((image, idx) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`p-3 border-2 rounded-lg text-left transition-all duration-200 ${
                      selectedImageIdx === idx
                        ? 'border-bossom-pink-300 bg-bossom-50'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {image.file_name}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {image.laterality ?? ''} {image.view_position ?? ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ROIs */}
          {latestAnalysis && (
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                Regions of Interest {rois.length > 0 && <span className="text-xs font-normal text-gray-500">({rois.length} found)</span>}
              </h3>
              {rois.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-2xl mb-2">✓</div>
                  <div className="text-sm font-medium text-green-700">No suspicious regions</div>
                  <div className="text-xs text-gray-400 mt-1">No abnormalities detected in this scan</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {rois.map((roi, i) => {
                    const malignant = (roi.malignancy_probability ?? 0) >= 0.5
                    const suspicious = (roi.malignancy_probability ?? 0) >= 0.2
                    return (
                      <div key={roi.id} className={`rounded-lg border p-3 ${malignant ? 'border-red-200 bg-red-50' : suspicious ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <FaExclamationTriangle className={`w-3.5 h-3.5 ${malignant ? 'text-red-500' : suspicious ? 'text-yellow-500' : 'text-blue-500'}`} />
                            <span className="text-sm font-semibold text-gray-900 capitalize">#{i + 1} {roi.roi_type}</span>
                          </div>
                          {roi.size_mm && <span className="text-xs text-gray-500">{roi.size_mm} mm</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs mb-2">
                          <div className="bg-white/70 rounded px-2 py-1">
                            <div className="text-gray-400">Confidence</div>
                            <div className="font-semibold text-gray-800">{Math.round(roi.confidence_score * 100)}%</div>
                          </div>
                          <div className="bg-white/70 rounded px-2 py-1">
                            <div className="text-gray-400">Malignancy</div>
                            <div className={`font-semibold ${malignant ? 'text-red-700' : suspicious ? 'text-yellow-700' : 'text-green-700'}`}>
                              {roi.malignancy_probability != null ? `${Math.round(roi.malignancy_probability * 100)}%` : 'N/A'}
                            </div>
                          </div>
                        </div>
                        {roi.characteristics && Object.keys(roi.characteristics).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {Object.entries(roi.characteristics).map(([k, v]) => (
                              <span key={k} className="text-xs bg-white/70 text-gray-600 px-1.5 py-0.5 rounded capitalize">{v}</span>
                            ))}
                          </div>
                        )}
                        {roi.clinical_significance && (
                          <div className={`text-xs font-medium ${malignant ? 'text-red-700' : suspicious ? 'text-yellow-700' : 'text-blue-700'}`}>
                            {roi.clinical_significance}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Run Analysis Button (when already have analysis but want to re-run) */}
          {latestAnalysis && caseData.images.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setRerunConfirm(caseData.images[selectedImageIdx]?.id ?? caseData.images[0].id)}
                disabled={analyzing}
                className={`${componentStyles.button.secondary} w-full flex items-center justify-center gap-2`}
              >
                {analyzing ? (
                  <><FaSpinner className="w-4 h-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><FaPlay className="w-4 h-4" /> Re-run Analysis</>
                )}
              </button>
            </div>
          )}
        </div>}

        {/* Main Viewer */}
        <div className="flex-1 bg-gray-900 flex flex-col">
          {/* Viewer Controls */}
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
            <div className="text-white text-sm font-medium">
              {selectedImage ? `${selectedImage.file_name} • ${selectedImage.laterality ?? ''} ${selectedImage.view_position ?? ''}` : 'No image selected'}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors">
                <FaSearchMinus className="w-4 h-4" />
              </button>
              <span className="text-gray-300 text-sm min-w-16 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors">
                <FaSearchPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image Display */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            <div className="relative bg-gray-800 rounded-lg overflow-hidden" style={{ transform: `scale(${zoom})` }}>
              {selectedImage?.publicUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selectedImage.publicUrl}
                  alt={selectedImage.file_name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="w-96 h-96 bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <FaEye className="w-12 h-12 mx-auto mb-2" />
                    <div className="text-sm">Mammogram Image</div>
                    <div className="text-xs">{selectedImage?.file_name ?? 'No image'}</div>
                  </div>
                </div>
              )}

              {/* ROI Overlays */}
              {rois.map((roi) => (
                <div
                  key={roi.id}
                  className={`absolute border-2 cursor-pointer transition-all duration-200 ${getROIColor(roi.malignancy_probability)}`}
                  style={{
                    left: `${roi.coordinates.x ?? 0}px`,
                    top: `${roi.coordinates.y ?? 0}px`,
                    width: `${roi.coordinates.width ?? 50}px`,
                    height: `${roi.coordinates.height ?? 50}px`,
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {Math.round(roi.confidence_score * 100)}% - {roi.roi_type}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info Bar */}
          <div className="bg-gray-800 px-4 py-2 text-gray-300 text-sm flex items-center justify-between">
            <div>{caseData.images.length} images • {rois.length} regions detected</div>
            <div>
              {latestAnalysis
                ? `BI-RADS ${latestAnalysis.birads_category} • ${Math.round((latestAnalysis.confidence_score ?? 0) * 100)}% confidence`
                : 'No analysis run yet'}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={rerunConfirm !== null}
        title="Re-run AI Analysis?"
        message="This will run a new analysis and replace the current results. Are you sure?"
        confirmLabel="Yes, Re-run"
        variant="primary"
        onConfirm={() => { if (rerunConfirm) { runAnalysis(rerunConfirm); setRerunConfirm(null) } }}
        onCancel={() => setRerunConfirm(null)}
      />

      {/* Next Steps Modal */}
      {nextStepsModal && latestAnalysis && (() => {
        const ns = getNextSteps(latestAnalysis.birads_category)
        if (!ns) return null
        const colorMap = {
          green:  { bg: 'bg-green-50',  border: 'border-green-200',  title: 'text-green-800',  badge: 'bg-green-100 text-green-700',  btn: 'bg-green-600 hover:bg-green-700' },
          yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', title: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700', btn: 'bg-yellow-600 hover:bg-yellow-700' },
          orange: { bg: 'bg-orange-50', border: 'border-orange-200', title: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-600 hover:bg-orange-700' },
          red:    { bg: 'bg-red-50',    border: 'border-red-200',    title: 'text-red-800',    badge: 'bg-red-100 text-red-700',      btn: 'bg-red-600 hover:bg-red-700' },
        }
        const c = colorMap[ns.color as keyof typeof colorMap]
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Modal header */}
              <div className={`${c.bg} ${c.border} border-b px-6 py-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl mb-2">{ns.icon}</div>
                    <h2 className={`text-xl font-bold ${c.title}`}>{ns.title}</h2>
                    <p className="text-gray-600 text-sm mt-1">{ns.heading}</p>
                  </div>
                  <button onClick={() => setNextStepsModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Result summary */}
              <div className="px-6 pt-4 pb-2">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getBiradsColor(latestAnalysis.birads_category)}`}>
                    BI-RADS {latestAnalysis.birads_category}
                  </span>
                  {latestAnalysis.confidence_score != null && (
                    <span className="text-sm text-gray-500">
                      {Math.round(latestAnalysis.confidence_score * 100)}% confidence
                    </span>
                  )}
                  {latestAnalysis.malignancy_probability != null && (
                    <span className={`text-sm font-medium ${(latestAnalysis.malignancy_probability) >= 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                      {Math.round(latestAnalysis.malignancy_probability * 100)}% malignancy risk
                    </span>
                  )}
                </div>

                {/* Next steps list */}
                <h3 className="font-semibold text-gray-800 mb-2">Recommended Next Steps</h3>
                <ol className="space-y-2 mb-4">
                  {ns.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700">
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full ${c.badge} flex items-center justify-center text-xs font-bold`}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 flex gap-3">
                <button
                  onClick={() => { setNextStepsModal(false); router.push('/dashboard') }}
                  className={`flex-1 py-2.5 ${c.btn} text-white font-medium rounded-lg text-sm transition-colors`}
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => setNextStepsModal(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}