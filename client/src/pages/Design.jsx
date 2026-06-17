import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import DesignPreview from '../components/DesignPreview'
import DesignCanvasEditor from '../components/DesignCanvasEditor'
import DesignIdeaUpload from '../components/DesignIdeaUpload'
import UserDesignUpload from '../components/UserDesignUpload'
import PexelsMediaPanel from '../components/PexelsMediaPanel'
import { BUILTIN_TEMPLATES } from '../constants/designTemplates'
import { getGraphicTemplate } from '../utils/graphicCanvas'
import { useDraftModule } from '../context/DraftContext'
import {
  CREATIVE_TYPES, CHANNELS, DIMENSIONS, VARIANT_COUNTS, DESIGN_STYLES,
} from '../constants/creative'

export default function Design() {
  const { workspaceId, fetchMe, workspace } = useAuth()
  const { workflow } = useCoreWorkflow()
  const [prompt, setPrompt] = useState(workflow.contentText || '')
  const [creativeType, setCreativeType] = useState('social_post')
  const [channels, setChannels] = useState(['instagram'])
  const [dimensionId, setDimensionId] = useState('1080x1080')
  const [variantCount, setVariantCount] = useState(5)
  const [style, setStyle] = useState('Modern')
  const [collectionMode, setCollectionMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [designs, setDesigns] = useState([])
  const [designIdea, setDesignIdea] = useState(workspace?.brandProfile?.designIdea || null)
  const [editingDesign, setEditingDesign] = useState(null)
  const [userTemplates, setUserTemplates] = useState([])
  const [library, setLibrary] = useState([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [templateLoading, setTemplateLoading] = useState(false)

  useDraftModule('design', () => ({
    prompt, creativeType, channels, dimensionId, variantCount, style,
    collectionMode, collectionName, designs, designIdea,
  }), (s) => {
    if (s.prompt) setPrompt(s.prompt)
    if (s.creativeType) setCreativeType(s.creativeType)
    if (s.channels) setChannels(s.channels)
    if (s.dimensionId) setDimensionId(s.dimensionId)
    if (s.variantCount) setVariantCount(s.variantCount)
    if (s.style) setStyle(s.style)
    if (s.collectionMode != null) setCollectionMode(s.collectionMode)
    if (s.collectionName) setCollectionName(s.collectionName)
    if (s.designs) setDesigns(s.designs)
    if (s.designIdea) setDesignIdea(s.designIdea)
  })

  useEffect(() => {
    if (workflow.contentText && !prompt) setPrompt(workflow.contentText)
  }, [workflow.contentText])

  useEffect(() => {
    if (workspace?.brandProfile?.designIdea && !designIdea) {
      setDesignIdea(workspace.brandProfile.designIdea)
    }
  }, [workspace?.brandProfile?.designIdea])

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/design/templates?workspaceId=${workspaceId}`)
      .then(r => setUserTemplates(r.data.templates || []))
      .catch(() => {})
  }, [workspaceId])

  const loadLibrary = async () => {
    try {
      const { data } = await API.get(`/design/library?workspaceId=${workspaceId}`)
      setLibrary(data.designs || [])
      setShowLibrary(true)
    } catch { toast.error('Could not load library') }
  }

  const startFromTemplate = async (templateId, customTemplate, graphicTemplate) => {
    const graphic = graphicTemplate || getGraphicTemplate(templateId)
    const builtin = !graphic ? BUILTIN_TEMPLATES.find(t => t.id === templateId) : graphic
    if (builtin?.recommendedDimension) setDimensionId(builtin.recommendedDimension)
    const sample = builtin?.sampleCopy
    const headline = prompt.split('\n')[0]?.slice(0, 80) || sample?.headline || 'Your Headline'
    const subheadline = prompt.slice(0, 120) || sample?.subheadline || ''
    const cta = sample?.cta || 'Learn More'
    const badge = sample?.badge || ''

    setTemplateLoading(true)
    try {
      const { data } = await API.post('/design/from-template', {
        workspaceId,
        templateId: customTemplate ? undefined : templateId,
        templatePlacements: customTemplate?.canvasLayout?.placements || customTemplate?.placements,
        headline,
        subheadline,
        cta,
        badge,
        dimensionId: builtin?.recommendedDimension || dimensionId,
      })
      setDesigns(prev => [data.design, ...prev])
      setEditingDesign(data.design)
      setSelectedTemplateId(templateId || customTemplate?._id)
      toast.success('Template ready — edit on canvas')
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create from template')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handlePexelsPhoto = async (item, useAs = 'background') => {
    const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline'
    const subheadline = prompt.slice(0, 120) || ''
    setTemplateLoading(true)
    try {
      const { data } = await API.post('/design/from-media', {
        workspaceId,
        mediaType: 'photo',
        pexelsId: item.id,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        photographer: item.photographer,
        photographerUrl: item.photographerUrl,
        useAs,
        dimensionId,
        headline,
        subheadline,
        cta: 'Learn More',
      })
      setDesigns(prev => [data.design, ...prev])
      setEditingDesign(data.design)
      toast.success(useAs === 'background' ? 'Photo set as background' : 'Photo added to design')
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add photo')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handlePexelsVideo = async (item) => {
    const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Video Design'
    setTemplateLoading(true)
    try {
      const { data } = await API.post('/design/from-media', {
        workspaceId,
        mediaType: 'video',
        pexelsId: item.id,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        photographer: item.photographer,
        photographerUrl: item.photographerUrl,
        dimensionId,
        headline,
        duration: item.duration,
      })
      setDesigns(prev => [data.design, ...prev])
      setEditingDesign(data.design)
      toast.success('Video added to designs')
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add video')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleBuiltinTemplate = (template) => {
    setSelectedTemplateId(template.id)
    startFromTemplate(template.id, null, true)
  }

  const handleUserTemplate = (template) => {
    setSelectedTemplateId(template._id)
    startFromTemplate(null, template)
  }

  const handleDesignSaved = (updated) => {
    const merge = d => (d._id === updated._id ? { ...d, ...updated } : d)
    setDesigns(prev => prev.map(merge))
    setLibrary(prev => prev.map(merge))
  }

  const toggleChannel = (id) => {
    setChannels(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(c => c !== id) : prev) : [...prev, id]
    )
  }

  const generate = async () => {
    if (!prompt.trim()) return toast.error('Enter a brief or content prompt')
    setLoading(true)
    try {
      const { data } = await API.post('/design/generate', {
        workspaceId, prompt, creativeType, channels, dimensionId,
        variantCount, style: style.toLowerCase(), collectionMode,
        designIdea,
      })
      setCollectionName(data.collectionName)
      setDesigns(data.designs)
      toast.success(`Generated ${data.designs.length} designs`)
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Design generation failed')
    } finally { setLoading(false) }
  }

  const favorite = async (design) => {
    if (!design._id) return
    try {
      await API.post(`/design/favorite/${design._id}`)
      setDesigns(prev => prev.map(d => d._id === design._id ? { ...d, favorited: true } : d))
      toast.success('Added to favorites')
    } catch { toast.error('Could not save favorite') }
  }

  return (
    <PageShell>
      <CoreWorkflowNav stepId="design" canProceed />

      <PageHeader
        title="Curi Design"
        description="Browse ready-made graphics or generate AI variations. Pick a template, customize on canvas, and publish."
      />

      <DesignTemplateGallery
        brandColors={workspace?.brandProfile?.colors?.palette}
        selectedId={selectedTemplateId}
        onSelect={handleBuiltinTemplate}
        userTemplates={userTemplates}
        onSelectUserTemplate={handleUserTemplate}
      />

      {templateLoading && (
        <p className="text-sm text-curi-pink font-medium mb-4 -mt-2">Applying template…</p>
      )}

      <PexelsMediaPanel
        workspaceId={workspaceId}
        onPhotoSelect={handlePexelsPhoto}
        onVideoSelect={handlePexelsVideo}
      />

      {/* Upload & design idea */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6 mt-6">
        <div className="page-card">
          <UserDesignUpload
            workspaceId={workspaceId}
            platform={channels[0] || 'instagram'}
            onUploaded={(uploaded) => setDesigns(prev => [...uploaded, ...prev])}
          />
        </div>

        <div className="page-card">
          <DesignIdeaUpload
            workspaceId={workspaceId}
            value={designIdea}
            onChange={setDesignIdea}
            compact
          />
        </div>
      </div>

      {/* Generation settings — spread across the page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <div className="page-card">
          <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-3">Creative Type</div>
          <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto">
            {CREATIVE_TYPES.map(t => (
              <label key={t.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-theme-subtle/5 cursor-pointer">
                <input type="radio" name="ctype" checked={creativeType === t.id} onChange={() => setCreativeType(t.id)} className="accent-curi-pink flex-shrink-0 w-4 h-4" />
                <span className="text-base text-theme-muted/70">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="page-card">
          <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-3">Target Channels</div>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map(c => (
              <label key={c.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${channels.includes(c.id) ? 'bg-curi-pink/10 text-curi-pink' : 'text-theme-muted/60 hover:bg-theme-subtle/5'}`}>
                <input type="checkbox" checked={channels.includes(c.id)} onChange={() => toggleChannel(c.id)} className="accent-curi-pink flex-shrink-0 w-4 h-4" />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-2">Dimensions</div>
            <select className="input w-full" value={dimensionId} onChange={e => setDimensionId(e.target.value)}>
              {DIMENSIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-2">Variants</div>
            <div className="flex gap-2">
              {VARIANT_COUNTS.map(n => (
                <button key={n} onClick={() => setVariantCount(n)}
                  className={`flex-1 py-2.5 rounded-xl text-base font-bold transition-all ${variantCount === n ? 'bg-curi-pink text-white' : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-2">Style Preset</div>
            <select className="input w-full" value={style} onChange={e => setStyle(e.target.value)}>
              {DESIGN_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <label className="card p-5 flex flex-col justify-center gap-3 cursor-pointer h-full">
          <input type="checkbox" checked={collectionMode} onChange={e => setCollectionMode(e.target.checked)} className="accent-curi-pink w-5 h-5" />
          <div>
            <div className="text-base font-bold text-theme-text">Design Collection</div>
            <div className="text-sm text-theme-muted/50 mt-1 leading-relaxed">Generate a cohesive series with cover, alternates, and story versions</div>
          </div>
        </label>
      </div>

      {/* Content brief — full width */}
      <div className="card p-5 mb-8">
        <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-3">Content Brief</div>
        <textarea
          className="input resize-none h-32 lg:h-36 text-base w-full"
          placeholder="Paste content from Curi Create, a product description, blog excerpt, script, or describe your creative..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-theme-muted/50 font-medium">5 credits per generation</span>
            <button type="button" onClick={loadLibrary} className="text-sm text-curi-blue font-bold hover:underline">
              Design Library
            </button>
          </div>
          <button onClick={generate} disabled={loading} className="btn-primary text-base px-6 py-3">
            {loading ? 'Generating...' : `Generate ${variantCount} Designs`}
          </button>
        </div>
      </div>

      {/* Generated designs — full width */}
      <AnimatePresence>
        {designs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-theme-text">{collectionName}</h2>
                <p className="text-sm text-theme-muted/50">{designs.length} variations — ranked by AI creative score</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {designs.map((d, i) => (
                <motion.div key={d._id || d.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                  <DesignPreview design={d} onFavorite={favorite} onEdit={setEditingDesign} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showLibrary && library.length > 0 && (
        <div className="card p-5 mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider">Design Library</div>
            <button type="button" onClick={() => setShowLibrary(false)} className="text-sm text-theme-muted/50">Hide</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {library.map(d => (
              <DesignPreview key={d._id} design={d} onEdit={setEditingDesign} compact />
            ))}
          </div>
        </div>
      )}

      {editingDesign && (
        <DesignCanvasEditor
          design={editingDesign}
          workspaceId={workspaceId}
          userTemplates={userTemplates}
          onClose={() => setEditingDesign(null)}
          onSaved={handleDesignSaved}
        />
      )}
    </PageShell>
  )
}
