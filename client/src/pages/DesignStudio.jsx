import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  LayoutTemplate, Image, Film, Type, Layers, Sparkles, Search, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, GripVertical, Volume2, Lightbulb, Mic,
} from 'lucide-react'
import { API, useAuth } from '../context/AuthContext'
import DesignStepGuide, { DESIGN_STEPS } from '../components/DesignStepGuide'
import DesignInspirationPanel from '../components/DesignInspirationPanel'
import DesignTemplateGallery from '../components/DesignTemplateGallery'
import DesignMediaPanel from '../components/DesignMediaPanel'
import AnimatedCharactersPanel from '../components/AnimatedCharactersPanel'
import DesignAudioPanel from '../components/DesignAudioPanel'
import DesignCanvasEditor from '../components/DesignCanvasEditor'
import { CANVAS_FONTS } from '../constants/canvasFonts'
import { useDesignCreation } from '../hooks/useDesignCreation'
import { isDraftDesign } from '../utils/localDesign'
import { buildDesignFromInspiration, buildCarouselFromInspiration } from '../utils/inspirationCanvas'
import { buildOwnDesignCanvas } from '../utils/inspirationSpec'
import DesignSchedulePanel from '../components/DesignSchedulePanel'
import { getPostFormat } from '../constants/postFormats'
import { applyCharacterToCanvas, applyTalkingCharacterToCanvas } from '../utils/characterCanvas'
import { applyAudioToCanvas } from '../utils/audioCanvas'
import toast from 'react-hot-toast'

const PANELS = [
  { id: 'inspiration', label: 'Inspire', icon: Lightbulb, step: 1 },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, step: 2 },
  { id: 'photos', label: 'Photos', icon: Image, step: 3 },
  { id: 'videos', label: 'Videos', icon: Film, step: 3 },
  { id: 'characters', label: 'Talk', icon: Mic, step: 3 },
  { id: 'audio', label: 'Audio', icon: Volume2, step: 3 },
  { id: 'text', label: 'Text', icon: Type, step: 4 },
  { id: 'elements', label: 'Elements', icon: Layers, step: 4 },
]

const STEP_PANEL = { 1: 'inspiration', 2: 'templates', 3: 'photos', 4: 'text', 5: 'finalize' }

const ASSET_PANEL_MIN = 220
const ASSET_PANEL_MAX = 560
const ASSET_PANEL_DEFAULT = 320
const ASSET_PANEL_WIDTH_KEY = 'curi_design_asset_panel_width'

const readStoredPanelWidth = () => {
  const w = Number(localStorage.getItem(ASSET_PANEL_WIDTH_KEY))
  if (!Number.isFinite(w)) return ASSET_PANEL_DEFAULT
  return Math.min(ASSET_PANEL_MAX, Math.max(ASSET_PANEL_MIN, w))
}

export default function DesignStudio() {
  const navigate = useNavigate()
  const { designId } = useParams()
  const [searchParams] = useSearchParams()
  const { workspace, fetchMe, loading: authLoading, user } = useAuth()
  const editorRef = useRef(null)
  const splitRef = useRef(null)
  const resizeDragRef = useRef(null)
  const panelWidthRef = useRef(ASSET_PANEL_DEFAULT)

  const [assetPanelWidth, setAssetPanelWidth] = useState(readStoredPanelWidth)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  panelWidthRef.current = assetPanelWidth

  const initialStep = Number(searchParams.get('step')) || 1
  const initialPanel = searchParams.get('panel') || STEP_PANEL[initialStep] || 'inspiration'

  const [step, setStep] = useState(initialStep)
  const [panel, setPanel] = useState(initialPanel)
  const [design, setDesign] = useState(null)
  const [brief, setBrief] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [generating, setGenerating] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [designIdea, setDesignIdea] = useState(null)
  const [postFormat, setPostFormat] = useState('social_post')
  const [dimensionId, setDimensionId] = useState('1080x1080')
  const [carouselSlideCount, setCarouselSlideCount] = useState(5)
  const [carouselDesigns, setCarouselDesigns] = useState([])
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [loadingDesign, setLoadingDesign] = useState(false)
  const [characterPanelFocus, setCharacterPanelFocus] = useState(null)

  const clearCharacterFocus = useCallback(() => setCharacterPanelFocus(null), [])

  const openCharactersPanel = useCallback((focus = 'talk') => {
    setStep(3)
    setPanel('characters')
    setPanelCollapsed(false)
    setCharacterPanelFocus(focus)
  }, [])

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
  } = useDesignCreation({
    prompt: brief,
    brandColors: workspace?.brandProfile?.colors?.palette,
  })

  useEffect(() => {
    if (workspace?.brandProfile?.designIdea) {
      setDesignIdea(workspace.brandProfile.designIdea)
    }
  }, [workspace?.brandProfile?.designIdea])

  useEffect(() => {
    if (authLoading || workspaceId || !user) return
    fetchMe?.()
  }, [authLoading, workspaceId, user, fetchMe])

  const completedSteps = useMemo(() => {
    const done = []
    if (designIdea?.imageUrl || design?.canvasLayout?.designIdeaBased || design?.canvasLayout?.aestheticOnly) done.push(1)
    if (design?.canvasLayout?.templateId || selectedTemplateId) done.push(2)
    const bg = design?.canvasLayout?.background
    if (bg?.type === 'image' || bg?.type === 'video' || bg?.type === 'aesthetic' || design?.canvasLayout?.audio || design?.canvasLayout?.elements?.some(e => e.type === 'image' || e.type === 'character' || e.type === 'talking-character')) {
      done.push(3)
    }
    if (design?.headline || design?.canvasLayout?.elements?.some(e => e.text && e.text !== 'Your Headline')) {
      done.push(4)
    }
    return done
  }, [design, selectedTemplateId, designIdea])

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
    if (!created) return
    setDesign(created)
    if (!isDraftDesign(created) && created._id) {
      navigate(`/design/studio/${created._id}`, { replace: true })
    }
  }

  useEffect(() => {
    const s = Number(searchParams.get('step'))
    const p = searchParams.get('panel')
    if (s >= 1 && s <= 5) setStep(s)
    if (p) setPanel(p)
  }, [searchParams])

  // Load existing design when opening a shared /studio/:id URL
  useEffect(() => {
    if (!workspaceId || !designId || String(designId).startsWith('draft-')) return
    if (design && isDraftDesign(design)) return
    if (design && String(design._id) === String(designId)) return
    let cancelled = false
    setLoadingDesign(true)
    loadDesign(designId).then((found) => {
      if (cancelled) return
      if (found) setDesign(found)
      else if (!design) toast.error('Design not found — pick a template to start')
      setLoadingDesign(false)
    })
    return () => { cancelled = true }
  }, [workspaceId, designId, loadDesign])

  useEffect(() => {
    const onPointerMove = (e) => {
      if (!resizeDragRef.current) return
      const delta = e.clientX - resizeDragRef.current.startX
      const next = Math.min(
        ASSET_PANEL_MAX,
        Math.max(ASSET_PANEL_MIN, resizeDragRef.current.startW + delta),
      )
      setAssetPanelWidth(next)
    }
    const onPointerUp = () => {
      if (!resizeDragRef.current) return
      resizeDragRef.current = null
      setIsResizing(false)
      localStorage.setItem(ASSET_PANEL_WIDTH_KEY, String(panelWidthRef.current))
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const startPanelResize = (e) => {
    if (panelCollapsed) return
    resizeDragRef.current = { startX: e.clientX, startW: assetPanelWidth }
    setIsResizing(true)
    e.preventDefault()
  }

  const nudgePanelWidth = (delta) => {
    setPanelCollapsed(false)
    setAssetPanelWidth((w) => {
      const next = Math.min(ASSET_PANEL_MAX, Math.max(ASSET_PANEL_MIN, w + delta))
      localStorage.setItem(ASSET_PANEL_WIDTH_KEY, String(next))
      return next
    })
  }

  const togglePanelCollapsed = () => {
    setPanelCollapsed((c) => !c)
  }

  const effectivePanelWidth = panelCollapsed ? 0 : assetPanelWidth

  const ensureDesign = async () => {
    if (design) return design
    const created = await startBlankCanvas()
    if (created) applyDesign(created)
    return created
  }

  const handleStepChange = (nextStep) => {
    setStep(nextStep)
    if (nextStep === 5) setPanel('finalize')
    else setPanel(STEP_PANEL[nextStep])
  }

  const handlePanelChange = (panelId) => {
    setPanel(panelId)
    const match = PANELS.find(p => p.id === panelId)
    if (match) setStep(match.step)
  }

  const handleTemplateSelect = async (template) => {
    setSelectedTemplateId(template.id)
    const created = await startFromTemplate(template.id)
    if (created) {
      applyDesign(created)
      setStep(3)
      setPanel('photos')
      toast.success('Template applied — add photos or continue customizing')
    }
  }

  const handleUserTemplate = async (template) => {
    setSelectedTemplateId(template._id)
    const created = await startFromTemplate(null, template)
    if (created) {
      applyDesign(created)
      setStep(3)
      setPanel('photos')
    }
  }

  const handlePhoto = async (item, useAs) => {
    if (editorRef.current && design) {
      editorRef.current.applyPexelsPhoto(item, useAs)
      setStep(4)
      return
    }
    const created = await createFromPexelsPhoto(item, useAs, design)
    if (created) {
      setDesign(created)
      setStep(4)
    }
  }

  const handleVideo = async (item) => {
    if (editorRef.current && design) {
      editorRef.current.applyPexelsVideo(item)
      setStep(4)
      return
    }
    const created = await createFromPexelsVideo(item, design)
    if (created) {
      setDesign(created)
      setStep(4)
    }
  }

  const handleCharacter = async (character) => {
    if (editorRef.current && design) {
      editorRef.current.applyCharacter(character)
      setStep(4)
      return
    }
    let d = design
    if (!d) {
      d = await startBlankCanvas()
      if (!d) return
      applyDesign(d)
    }
    const canvasLayout = applyCharacterToCanvas(d.canvasLayout, character)
    setDesign({ ...d, canvasLayout })
    setStep(4)
    toast.success(`Added ${character.name}`)
  }

  const handleTalkingCharacter = async (payload) => {
    if (editorRef.current && design) {
      editorRef.current.applyTalkingCharacter(payload)
      setStep(4)
      return
    }
    let d = design
    if (!d) {
      d = await startBlankCanvas()
      if (!d) return
      applyDesign(d)
    }
    const canvasLayout = applyTalkingCharacterToCanvas(d.canvasLayout, payload)
    setDesign({ ...d, canvasLayout })
    setStep(4)
  }

  const handleAudio = async (audio) => {
    if (editorRef.current && design) {
      editorRef.current.applyAudio(audio)
      setStep(4)
      return
    }
    let d = design
    if (!d) {
      d = await startBlankCanvas()
      if (!d) return
      applyDesign(d)
    }
    const canvasLayout = applyAudioToCanvas(d.canvasLayout, audio)
    setDesign({ ...d, canvasLayout })
    setStep(4)
  }

  const handleOwnDesignUploaded = (designs) => {
    const uploaded = designs?.[0]
    if (!uploaded) return
    const imageUrl = uploaded.previewDataUrl || uploaded.mediaUrl || uploaded.thumbnailUrl
    const canvasLayout = buildOwnDesignCanvas({
      imageUrl,
      name: uploaded.title || uploaded.name || 'My Design',
      dimensionId,
    })
    const created = {
      _id: uploaded._id,
      _local: false,
      name: uploaded.title || uploaded.name || 'My Design',
      headline: '',
      subheadline: '',
      cta: '',
      canvasLayout,
      dimensions: { id: dimensionId },
      mediaUrl: imageUrl,
      source: 'user-upload',
    }
    setDesign(created)
    if (uploaded._id) navigate(`/design/studio/${uploaded._id}`, { replace: true })
    setStep(5)
    setPanel('finalize')
    toast.success(uploaded.scheduledAt ? 'Design uploaded and scheduled' : 'Your design is ready — review and schedule below')
  }

  const handleExtractInspiration = async (idea = designIdea) => {
    if (!idea?.imageUrl && !idea?.notes) {
      return toast.error('Upload an inspiration image or add notes first')
    }
    setExtracting(true)
    setCarouselDesigns([])
    try {
      const format = getPostFormat(postFormat)
      const useLocal = idea.analyzedSpec?.aestheticOnly && idea.imageUrl

      if (useLocal) {
        const created = buildDesignFromInspiration({
          designIdea: idea,
          brandColors: workspace?.brandProfile?.colors?.palette,
          prompt: brief,
          dimensionId,
          postFormat,
        })
        applyDesign(created)
        setSelectedTemplateId(created.templateId)
        setStep(4)
        setPanel('text')
        toast.success(`${format.label} created — aesthetics only, your copy on canvas`)
        return
      }

      const { data } = await API.post('/design/from-inspiration', {
        workspaceId,
        designIdea: idea,
        prompt: brief,
        dimensionId,
        postFormat,
        creativeType: format.creativeType,
        templateId: format.templateId,
      })
      if (data.design) {
        applyDesign(data.design)
        if (data.designIdea) setDesignIdea(data.designIdea)
        setSelectedTemplateId(data.design.templateId || data.design.canvasLayout?.templateId)
        setStep(4)
        setPanel('text')
        toast.success(`${format.label} created from inspiration`)
        fetchMe?.()
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not extract design from inspiration')
    } finally {
      setExtracting(false)
    }
  }

  const handleExtractCarousel = async (idea = designIdea) => {
    if (!idea?.imageUrl && !idea?.notes) {
      return toast.error('Upload an inspiration image first')
    }
    setExtracting(true)
    try {
      const slides = buildCarouselFromInspiration({
        designIdea: idea,
        brandColors: workspace?.brandProfile?.colors?.palette,
        prompt: brief,
        dimensionId,
        postFormat: 'carousel',
        slideCount: carouselSlideCount,
      })
      setCarouselDesigns(slides)
      setCarouselIndex(0)
      applyDesign(slides[0])
      setSelectedTemplateId(slides[0].templateId)
      setStep(4)
      setPanel('text')
      toast.success(`Created ${slides.length} carousel slides — editing slide 1`)
    } catch (err) {
      toast.error(err.message || 'Could not create carousel')
    } finally {
      setExtracting(false)
    }
  }

  const switchCarouselSlide = (index) => {
    if (!carouselDesigns[index]) return
    setCarouselIndex(index)
    applyDesign(carouselDesigns[index])
  }

  const handleGenerate = async () => {
    if (!brief.trim() && !designIdea?.imageUrl) {
      return toast.error('Describe your ideal design or upload inspiration first')
    }
    setGenerating(true)
    try {
      const { data } = await API.post('/design/generate', {
        workspaceId,
        prompt: brief || 'Design based on uploaded inspiration',
        creativeType: getPostFormat(postFormat).creativeType,
        channels: ['instagram'],
        dimensionId,
        variantCount: 1,
        style: 'modern',
        designIdea,
      })
      const first = data.designs?.[0]
      if (first) {
        applyDesign(first)
        setStep(4)
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
    setDesign(prev => ({ ...prev, ...updated, _local: false }))
    if (updated._id && !isDraftDesign(updated)) {
      navigate(`/design/studio/${updated._id}`, { replace: true })
    }
  }

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-theme-muted/60">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-sm font-medium">Loading workspace…</span>
      </div>
    )
  }

  if (!workspaceId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Loader2 className="animate-spin text-theme-muted/40" size={28} />
        <div>
          <p className="text-sm font-semibold text-theme-text">Couldn't load your workspace</p>
          <p className="text-xs text-theme-muted/60 mt-1 max-w-sm">
            Try again, or sign out and back in. If Design Studio still fails, hard-refresh to clear cached files (Cmd+Shift+R).
          </p>
        </div>
        <button type="button" onClick={() => fetchMe?.()} className="btn-primary text-sm">
          Retry
        </button>
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

      <div ref={splitRef} className={`relative flex flex-1 min-h-0 ${isResizing ? 'select-none cursor-col-resize' : ''}`}>
        {/* Icon rail */}
        <div className="w-16 flex-shrink-0 border-r border-theme-border bg-theme-surface flex flex-col items-center py-3 gap-1">
          {PANELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handlePanelChange(id)}
              title={`${label}${id === 'characters' ? ' — make mascots speak or upload a portrait' : ''}`}
              className={`w-12 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
                panel === id
                  ? 'bg-curi-pink/15 text-curi-pink'
                  : 'text-theme-muted/50 hover:bg-theme-subtle/5 hover:text-theme-text'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-bold leading-none">{label}</span>
            </button>
          ))}
        </div>

        {/* Asset panel — resizable width */}
        <div
          className="flex-shrink-0 bg-theme-surface flex flex-col min-h-0 overflow-hidden border-r border-theme-border"
          style={{ width: effectivePanelWidth, transition: isResizing ? 'none' : 'width 0.15s ease' }}
        >
          {panelCollapsed && (
            <div className="absolute left-16 top-1/2 -translate-y-1/2 z-30 ml-2">
              <button
                type="button"
                onClick={() => setPanelCollapsed(false)}
                className="btn-secondary text-xs py-2 px-3 shadow-clay-sm whitespace-nowrap"
              >
                Show assets panel
              </button>
            </div>
          )}
          {!panelCollapsed && (
          <>
          <div className="p-3 border-b border-theme-border flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">Assets</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => nudgePanelWidth(-48)}
                  disabled={assetPanelWidth <= ASSET_PANEL_MIN}
                  className="p-1 rounded-md text-theme-muted/50 hover:text-theme-text hover:bg-theme-subtle/10 disabled:opacity-30"
                  title="Narrow panel"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePanelWidth(48)}
                  disabled={assetPanelWidth >= ASSET_PANEL_MAX}
                  className="p-1 rounded-md text-theme-muted/50 hover:text-theme-text hover:bg-theme-subtle/10 disabled:opacity-30"
                  title="Widen panel"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <textarea
              className="input w-full resize-none h-20"
              placeholder="Describe your ideal design…"
              value={brief}
              onChange={e => setBrief(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary flex-1 py-2 flex items-center justify-center gap-1.5"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
              <button
                type="button"
                onClick={handleSearch}
                className="btn-secondary flex-1 py-2 flex items-center justify-center gap-1.5"
              >
                <Search size={14} /> Search
              </button>
            </div>
            <p className="text-sm text-theme-muted/50 leading-snug">
              Step {step} of 5 — {DESIGN_STEPS.find(s => s.id === step)?.description}
            </p>
            {carouselDesigns.length > 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {carouselDesigns.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => switchCarouselSlide(i)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      carouselIndex === i
                        ? 'bg-curi-pink text-white border-curi-pink'
                        : 'border-theme-border text-theme-muted/60'
                    }`}
                  >
                    Slide {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {panel === 'inspiration' && (
              <DesignInspirationPanel
                embedded
                workspaceId={workspaceId}
                value={designIdea}
                onChange={setDesignIdea}
                onExtract={handleExtractInspiration}
                onExtractCarousel={handleExtractCarousel}
                onOwnDesignUploaded={handleOwnDesignUploaded}
                extracting={extracting}
                brief={brief}
                postFormat={postFormat}
                onPostFormatChange={setPostFormat}
                dimensionId={dimensionId}
                onDimensionChange={setDimensionId}
                carouselSlideCount={carouselSlideCount}
                onCarouselSlideCountChange={setCarouselSlideCount}
              />
            )}

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
              <DesignMediaPanel
                workspaceId={workspaceId}
                mediaType="photos"
                compact
                embedded
                externalSearch={searchQuery}
                onPhotoSelect={handlePhoto}
                onVideoSelect={handleVideo}
              />
            )}

            {panel === 'videos' && (
              <DesignMediaPanel
                workspaceId={workspaceId}
                mediaType="videos"
                compact
                embedded
                externalSearch={searchQuery}
                onPhotoSelect={handlePhoto}
                onVideoSelect={handleVideo}
              />
            )}

            {panel === 'characters' && (
              <AnimatedCharactersPanel
                embedded
                workspaceId={workspaceId}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelect={handleCharacter}
                onTalkingCharacter={handleTalkingCharacter}
                focusMode={characterPanelFocus}
                onFocusHandled={clearCharacterFocus}
              />
            )}

            {panel === 'audio' && (
              <DesignAudioPanel
                embedded
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAddAudio={handleAudio}
                currentAudio={design?.canvasLayout?.audio}
              />
            )}

            {panel === 'text' && (
              <div className="space-y-3">
                <p className="text-xs text-theme-muted/60">
                  Select text on the canvas to edit headline, subheadline, and CTA. Or add a new text layer.
                </p>
                <div>
                  <div className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider mb-2">Font styles</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CANVAS_FONTS.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        disabled={!design}
                        onClick={() => editorRef.current?.applyFontStyle(font.id, 'headline')}
                        className="px-2 py-2 rounded-lg border border-theme-border text-left hover:border-curi-pink/40 hover:bg-curi-pink/5 disabled:opacity-40 transition-all"
                        style={{ fontFamily: font.family }}
                      >
                        <span className="block text-sm font-bold text-theme-text leading-tight">{font.label}</span>
                        <span className="block text-[9px] text-theme-muted/50">{font.category}</span>
                      </button>
                    ))}
                  </div>
                  {design && (
                    <button
                      type="button"
                      onClick={() => editorRef.current?.applyFontStyle('poppins', 'all')}
                      className="btn-secondary w-full text-xs mt-2"
                    >
                      Apply Poppins to all text
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => editorRef.current?.addTextLayer()}
                  className="btn-secondary w-full text-sm"
                >
                  + Add text layer
                </button>
                <div className="card p-3 space-y-2 text-xs text-theme-muted/60">
                  <p><strong className="text-theme-text">Tip:</strong> Click any text on the canvas to edit font, color, and position in the properties panel on the right.</p>
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
                {DESIGN_STEPS.slice(0, 4).map(s => (
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
                <DesignSchedulePanel
                  design={design}
                  workspaceId={workspaceId}
                />
              </div>
            )}

            {(templateLoading || generating || extracting) && (
              <p className="text-xs text-curi-pink font-medium mt-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Working…
              </p>
            )}
          </div>
          </>
          )}
        </div>

        {/* Split resize handle */}
        <div className="relative flex-shrink-0 w-0 z-10">
          <button
            type="button"
            onClick={togglePanelCollapsed}
            className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-6 h-10 rounded-full border border-theme-border bg-theme-surface shadow-clay-sm text-theme-muted/60 hover:text-curi-pink hover:border-curi-pink/40 transition-colors"
            title={panelCollapsed ? 'Expand assets panel' : 'Collapse assets panel'}
          >
            {panelCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          {!panelCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize assets panel"
              onPointerDown={startPanelResize}
              className={`absolute inset-y-0 left-0 -translate-x-1/2 w-3 cursor-col-resize group flex items-center justify-center ${
                isResizing ? 'bg-curi-pink/20' : 'hover:bg-curi-pink/10'
              }`}
            >
              <GripVertical
                size={14}
                className={`text-theme-muted/30 group-hover:text-curi-pink/70 ${isResizing ? 'text-curi-pink' : ''}`}
              />
            </div>
          )}
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
              onOpenCharactersPanel={openCharactersPanel}
              showNext={step < 5}
              onNext={() => handleStepChange(step + 1)}
              nextLabel={step === 4 ? 'Finalize' : 'Next'}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-theme-subtle/5 p-8 text-center">
              <LayoutTemplate size={48} className="text-theme-muted/30 mb-4" />
              <h3 className="text-base font-bold text-theme-text mb-2">Start your creative</h3>
              <p className="text-xs text-theme-muted/60 max-w-sm mb-6">
                Upload design inspiration in Step 1, pick your post format and dimensions, then extract to canvas.
              </p>
              <button
                type="button"
                onClick={ensureDesign}
                disabled={templateLoading}
                className="btn-secondary text-xs"
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
