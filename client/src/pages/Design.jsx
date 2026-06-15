import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import DesignPreview from '../components/DesignPreview'
import DesignCanvasEditor from '../components/DesignCanvasEditor'
import DesignIdeaUpload from '../components/DesignIdeaUpload'
import UserDesignUpload from '../components/UserDesignUpload'
import { BUILTIN_TEMPLATES } from '../constants/designTemplates'
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

  const startFromTemplate = async (templateId, customTemplate) => {
    try {
      const { data } = await API.post('/design/from-template', {
        workspaceId,
        templateId: customTemplate ? undefined : templateId,
        templatePlacements: customTemplate?.canvasLayout?.placements || customTemplate?.placements,
        headline: prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline',
        subheadline: prompt.slice(0, 120) || '',
        dimensionId,
      })
      setDesigns(prev => [data.design, ...prev])
      setEditingDesign(data.design)
      toast.success('Template ready — edit on canvas')
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create from template')
    }
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
    <div className="p-8 max-w-7xl">
      <CoreWorkflowNav stepId="design" canProceed />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Design</h1>
        <p className="text-theme-muted/50">Transform content into high-converting visual creatives. Generate multiple variations optimized for every channel.</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Creative Type</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {CREATIVE_TYPES.map(t => (
                <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-subtle/5 cursor-pointer">
                  <input type="radio" name="ctype" checked={creativeType === t.id} onChange={() => setCreativeType(t.id)} className="accent-curi-pink" />
                  <span className="text-sm text-theme-muted/70">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Target Channels</div>
            <div className="grid grid-cols-2 gap-1.5">
              {CHANNELS.map(c => (
                <label key={c.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors ${channels.includes(c.id) ? 'bg-curi-pink/10 text-curi-pink' : 'text-theme-muted/50 hover:bg-theme-subtle/5'}`}>
                  <input type="checkbox" checked={channels.includes(c.id)} onChange={() => toggleChannel(c.id)} className="accent-curi-pink" />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Dimensions</div>
            <select className="input text-sm" value={dimensionId} onChange={e => setDimensionId(e.target.value)}>
              {DIMENSIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Variants</div>
            <div className="flex gap-2">
              {VARIANT_COUNTS.map(n => (
                <button key={n} onClick={() => setVariantCount(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${variantCount === n ? 'bg-curi-pink text-white' : 'bg-theme-subtle/5 text-theme-muted/50 hover:text-theme-text'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Style Preset</div>
            <select className="input text-sm" value={style} onChange={e => setStyle(e.target.value)}>
              {DESIGN_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <label className="card p-4 flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={collectionMode} onChange={e => setCollectionMode(e.target.checked)} className="accent-curi-pink" />
            <div>
              <div className="text-sm font-bold text-theme-text">Design Collection</div>
              <div className="text-xs text-theme-muted/40">Generate a cohesive series with cover, alternates, and story versions</div>
            </div>
          </label>

          <div className="card p-4">
            <UserDesignUpload
              workspaceId={workspaceId}
              platform={channels[0] || 'instagram'}
              onUploaded={(uploaded) => setDesigns(prev => [...uploaded, ...prev])}
            />
          </div>

          <div className="card p-4">
            <DesignIdeaUpload
              workspaceId={workspaceId}
              value={designIdea}
              onChange={setDesignIdea}
              compact
            />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Templates</div>
              <button type="button" onClick={loadLibrary} className="text-[10px] text-curi-blue font-bold hover:underline">Library</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {BUILTIN_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => startFromTemplate(t.id)}
                  className="w-full text-left p-2 rounded-lg border border-theme-border hover:border-curi-pink/30 text-xs transition-all"
                >
                  <div className="font-bold text-theme-text">{t.name}</div>
                  <div className="text-theme-muted/40">{t.description}</div>
                </button>
              ))}
              {userTemplates.map(t => (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => startFromTemplate(null, t)}
                  className="w-full text-left p-2 rounded-lg border border-curi-blue/20 hover:border-curi-blue/40 text-xs"
                >
                  <div className="font-bold text-theme-text">{t.name}</div>
                  <div className="text-theme-muted/40">Your template</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-5">
          <div className="card p-5">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Content Brief</div>
            <textarea
              className="input resize-none h-32 text-base"
              placeholder="Paste content from Curi Create, a product description, blog excerpt, script, or describe your creative..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-theme-muted/40 font-medium">5 credits per generation</span>
              <button onClick={generate} disabled={loading} className="btn-primary">
                {loading ? 'Generating...' : `Generate ${variantCount} Designs`}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {designs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-theme-text">{collectionName}</h2>
                    <p className="text-xs text-theme-muted/40">{designs.length} variations — ranked by AI creative score</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
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
            <div className="card p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Design Library</div>
                <button type="button" onClick={() => setShowLibrary(false)} className="text-xs text-theme-muted/40">Hide</button>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {library.map(d => (
                  <DesignPreview key={d._id} design={d} onEdit={setEditingDesign} compact />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editingDesign && (
        <DesignCanvasEditor
          design={editingDesign}
          workspaceId={workspaceId}
          userTemplates={userTemplates}
          onClose={() => setEditingDesign(null)}
          onSaved={handleDesignSaved}
        />
      )}
    </div>
  )
}
