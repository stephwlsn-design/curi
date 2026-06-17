import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  LayoutTemplate, Image, Film, Type, Layers, Sparkles, Search, Loader2, CheckCircle2,
} from 'lucide-react'
import { API, useAuth } from '../context/AuthContext'
import DesignStepGuide, { DESIGN_STEPS } from '../components/DesignStepGuide'
import DesignTemplateGallery from '../components/DesignTemplateGallery'
import PexelsMediaPanel from '../components/PexelsMediaPanel'
import DesignCanvasEditor from '../components/DesignCanvasEditor'
import { useDesignCreation } from '../hooks/useDesignCreation'
import toast from 'react-hot-toast'

const PANELS = [
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, step: 1 },
  { id: 'photos', label: 'Photos', icon: Image, step: 2 },
  { id: 'videos', label: 'Videos', icon: Film, step: 2 },
  { id: 'text', label: 'Text', icon: Type, step: 3 },
  { id: 'elements', label: 'Elements', icon: Layers, step: 3 },
]

const STEP_PANEL = { 1: 'templates', 2: 'photos', 3: 'text', 4: 'finalize' }

export default function DesignStudio() {
  const navigate = useNavigate()
  const { designId } = useParams()
  const [searchParams] = useSearchParams()
  const { workspace, fetchMe, loading: authLoading } = useAuth()
  const editorRef = useRef(null)

  const initialStep = Number(searchParams.get('step')) || 1
  const initialPanel = searchParams.get('panel') || STEP_PANEL[initialStep] || 'templates'

  const [step, setStep] = useState(initialStep)
  const [panel, setPanel] = useState(initialPanel)
  const [design, setDesign] = useState(null)
  const [brief, setBrief] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loadingDesign, setLoadingDesign] = useState(false)

  const {
    workspaceId,
    userTemplates,
    templateLoading,
    selectedTemplateId,
    setSelectedTemplateId,
    startFromTemplate,
    startBlankCanvas,
    createFromPexelsPhoto,
    createFromPexelsVideo,
  } = useDesignCreation({ prompt: brief })

  const completedSteps = useMemo(() => {
    const done = []
    if (design?.canvasLayout?.templateId || selectedTemplateId) done.push(1)
    const bg = design?.canvasLayout?.background
    if (bg?.type === 'image' || bg?.type === 'video' || design?.canvasLayout?.elements?.some(e => e.type === 'image')) {
      done.push(2)
    }
    if (design?.headline || design?.canvasLayout?.elements?.some(e => e.text && e.text !== 'Your Headline')) {
      done.push(3)
    }
    return done
  }, [design, selectedTemplateId])

  const loadDesign = useCallback(async (id) => {
    if (!workspaceId || !id) return null
    try {
      const { data } = await API.get(`/design/library?workspaceId=${workspaceId}`)
      return (data.designs || []).find(d => String(d._id) === String(id)) || null
    } catch {
      toast.error('Could not load design')
      return null
    }
  }, [workspaceId])

  const applyDesign = (created) => {
    if (!created?._id) return
    setDesign(created)
    navigate(`/design/studio/${created._id}`, { replace: true })
  }

  useEffect(() => {
    const s = Number(searchParams.get('step'))
    const p = searchParams.get('panel')
    if (s >= 1 && s <= 4) setStep(s)
    if (p) setPanel(p)
  }, [searchParams])

  // Load existing design when opening a shared /studio/:id URL
  useEffect(() => {
    if (!workspaceId || !designId) return
    let cancelled = false
    setLoadingDesign(true)
    loadDesign(designId).then((found) => {
      if (cancelled) return
      if (found) setDesign(found)
      else toast.error('Design not found — pick a template to start')
      setLoadingDesign(false)
    })
    return () => { cancelled = true }
  }, [workspaceId, designId, loadDesign])

  const ensureDesign = async () => {
    if (design) return design
    const created = await startBlankCanvas()
    if (created) applyDesign(created)
    return created
  }

  const handleStepChange = (nextStep) => {
    setStep(nextStep)
    if (nextStep === 4) setPanel('finalize')
    else setPanel(STEP_PANEL[nextStep])
  }

  const handlePanelChange = (panelId) => {
    setPanel(panelId)
    const match = PANELS.find(p => p.id === panelId)
    if (match) setStep(match.step)
  }

  const handleTemplateSelect = async (template) => {
    setSelectedTemplateId(template.id)
    const created = await startFromTemplate(template.id, null, true)
    if (created) {
      applyDesign(created)
      setStep(2)
      setPanel('photos')
      toast.success('Template applied — add photos or continue customizing')
    }
  }

  const handleUserTemplate = async (template) => {
    setSelectedTemplateId(template._id)
    const created = await startFromTemplate(null, template)
    if (created) {
      applyDesign(created)
      setStep(2)
      setPanel('photos')
    }
  }

  const handlePhoto = async (item, useAs) => {
    if (editorRef.current) {
      editorRef.current.applyPexelsPhoto(item, useAs)
      setStep(3)
      return
    }
    const created = await createFromPexelsPhoto(item, useAs)
    if (created) {
      applyDesign(created)
      setStep(3)
    }
  }

  const handleVideo = async (item) => {
    if (editorRef.current) {
      editorRef.current.applyPexelsVideo(item)
      setStep(3)
      return
    }
    const created = await createFromPexelsVideo(item)
    if (created) {
      applyDesign(created)
      setStep(3)
    }
  }

  const handleGenerate = async () => {
    if (!brief.trim()) return toast.error('Describe your ideal design first')
    setGenerating(true)
    try {
      const { data } = await API.post('/design/generate', {
        workspaceId,
        prompt: brief,
        creativeType: 'social_post',
        channels: ['instagram'],
        dimensionId: '1080x1080',
        variantCount: 1,
        style: 'modern',
      })
      const first = data.designs?.[0]
      if (first) {
        applyDesign(first)
        setStep(3)
        setPanel('text')
        toast.success('Design generated — customize on canvas')
        fetchMe?.()
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSearch = () => {
    setSearchQuery(brief.trim())
    if (panel === 'photos' || panel === 'videos') {
      toast.success('Searching stock media…')
    }
  }

  const handleFinalize = async () => {
    if (editorRef.current) {
      await editorRef.current.saveDesign()
      toast.success('Creative asset saved to your library')
    }
  }

  const handleDesignSaved = (updated) => {
    setDesign(prev => (prev?._id === updated._id ? { ...prev, ...updated } : prev))
  }

  if (authLoading || !workspaceId) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-theme-muted/60">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-sm font-medium">Loading workspace…</span>
      </div>
    )
  }

  if (loadingDesign && designId && !design) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-theme-muted/60">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-sm font-medium">Loading design…</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-theme-bg overflow-hidden">
      <DesignStepGuide
        currentStep={step}
        onStepChange={handleStepChange}
        completedSteps={completedSteps}
      />

      <div className="flex flex-1 min-h-0">
        {/* Icon rail */}
        <div className="w-16 flex-shrink-0 border-r border-theme-border bg-theme-surface flex flex-col items-center py-3 gap-1">
          {PANELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handlePanelChange(id)}
              title={label}
              className={`w-12 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
                panel === id
                  ? 'bg-curi-pink/15 text-curi-pink'
                  : 'text-theme-muted/50 hover:bg-theme-subtle/5 hover:text-theme-text'
              }`}
            >
              <Icon size={18} />
              <span className="text-[9px] font-bold leading-none">{label}</span>
            </button>
          ))}
        </div>

        {/* Asset panel */}
        <div className="w-80 flex-shrink-0 border-r border-theme-border bg-theme-surface flex flex-col min-h-0">
          <div className="p-3 border-b border-theme-border flex-shrink-0 space-y-2">
            <textarea
              className="input w-full text-sm resize-none h-20"
              placeholder="Describe your ideal design…"
              value={brief}
              onChange={e => setBrief(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
              <button
                type="button"
                onClick={handleSearch}
                className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
              >
                <Search size={14} /> Search
              </button>
            </div>
            <p className="text-[10px] text-theme-muted/50 leading-snug">
              Step {step} of 4 — {DESIGN_STEPS.find(s => s.id === step)?.description}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {panel === 'templates' && (
              <DesignTemplateGallery
                embedded
                brandColors={workspace?.brandProfile?.colors?.palette}
                selectedId={selectedTemplateId}
                onSelect={handleTemplateSelect}
                userTemplates={userTemplates}
                onSelectUserTemplate={handleUserTemplate}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}

            {panel === 'photos' && (
              <PexelsMediaPanel
                workspaceId={workspaceId}
                compact
                embedded
                defaultTab="photos"
                externalSearch={searchQuery}
                onPhotoSelect={handlePhoto}
                onVideoSelect={handleVideo}
              />
            )}

            {panel === 'videos' && (
              <PexelsMediaPanel
                workspaceId={workspaceId}
                compact
                embedded
                defaultTab="videos"
                externalSearch={searchQuery}
                onPhotoSelect={handlePhoto}
                onVideoSelect={handleVideo}
              />
            )}

            {panel === 'text' && (
              <div className="space-y-3">
                <p className="text-xs text-theme-muted/60">
                  Select text on the canvas to edit headline, subheadline, and CTA. Or add a new text layer.
                </p>
                <button
                  type="button"
                  onClick={() => editorRef.current?.addTextLayer()}
                  className="btn-secondary w-full text-sm"
                >
                  + Add text layer
                </button>
                <div className="card p-3 space-y-2 text-xs text-theme-muted/60">
                  <p><strong className="text-theme-text">Tip:</strong> Click any text on the canvas to edit font, color, and position in the properties panel.</p>
                </div>
              </div>
            )}

            {panel === 'elements' && (
              <div className="space-y-3 text-xs text-theme-muted/60">
                <p>Use the properties panel on the right of the canvas to adjust layers, backgrounds, and overlays.</p>
                <button
                  type="button"
                  onClick={() => ensureDesign()}
                  className="btn-secondary w-full text-sm"
                >
                  Reset to blank layout
                </button>
              </div>
            )}

            {panel === 'finalize' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-theme-text uppercase tracking-wider">Review your creative</div>
                <p className="text-xs text-theme-muted/60">
                  Confirm each step is complete, then save your final asset to the design library.
                </p>
                {DESIGN_STEPS.slice(0, 3).map(s => (
                  <div key={s.id} className="flex items-start gap-2 text-xs">
                    <CheckCircle2
                      size={16}
                      className={completedSteps.includes(s.id) ? 'text-curi-green flex-shrink-0' : 'text-theme-muted/30 flex-shrink-0'}
                    />
                    <div>
                      <div className="font-semibold text-theme-text">Step {s.id}: {s.label}</div>
                      <div className="text-theme-muted/50">{s.description}</div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={handleFinalize} className="btn-primary w-full text-sm">
                  Save final creative
                </button>
              </div>
            )}

            {(templateLoading || generating) && (
              <p className="text-xs text-curi-pink font-medium mt-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Working…
              </p>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0 min-h-0">
          {design ? (
            <DesignCanvasEditor
              key={design._id}
              ref={editorRef}
              embedded
              hideAssetSidebar
              hideClose
              design={design}
              workspaceId={workspaceId}
              userTemplates={userTemplates}
              onSaved={handleDesignSaved}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-theme-subtle/5 p-8 text-center">
              <LayoutTemplate size={48} className="text-theme-muted/30 mb-4" />
              <h3 className="text-lg font-bold text-theme-text mb-2">Start your creative</h3>
              <p className="text-sm text-theme-muted/60 max-w-sm mb-6">
                Choose a template from the left, search stock photos, or describe your design and hit Generate.
              </p>
              <button
                type="button"
                onClick={ensureDesign}
                disabled={templateLoading}
                className="btn-secondary text-sm"
              >
                {templateLoading ? 'Creating…' : 'Or start with a blank canvas'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
