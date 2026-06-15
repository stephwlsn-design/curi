import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { useDraft } from '../context/DraftContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { FileText, Trash2, ArrowRight } from 'lucide-react'
import SaveDraftButton from '../components/SaveDraftButton'

const STEP_LABELS = {
  discover: 'Discover',
  create: 'Create',
  design: 'Design',
  video: 'Video',
  mail: 'Mail',
  launch: 'Launch',
  autonomous: 'Autonomous',
}

export default function Drafts() {
  const { workspaceId } = useAuth()
  const { restoreDraft, activeDraftId } = useDraft()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const { data } = await API.get(`/drafts?workspaceId=${workspaceId}`)
      setDrafts(data.drafts || [])
    } catch {
      toast.error('Could not load drafts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [workspaceId])

  const remove = async (id) => {
    try {
      await API.delete(`/drafts/${id}`)
      setDrafts(prev => prev.filter(d => d._id !== id))
      toast.success('Draft deleted')
    } catch {
      toast.error('Could not delete draft')
    }
  }

  const resume = async (draft) => {
    await restoreDraft(draft)
  }

  const moduleSummary = (draft) => {
    const mods = draft.modules || {}
    const parts = []
    if (mods.discover?.url) parts.push('Brand')
    if (mods.create?.topic || draft.coreWorkflow?.contentText) parts.push('Content')
    if (mods.design?.designs?.length) parts.push(`${mods.design.designs.length} designs`)
    if (mods.video?.videos?.length) parts.push(`${mods.video.videos.length} videos`)
    if (mods.launch?.goal) parts.push('Launch')
    if (mods.autonomous?.days) parts.push('Autonomous')
    return parts.length ? parts.join(' · ') : 'Workflow in progress'
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme-text mb-2">Saved Drafts</h1>
          <p className="text-theme-muted/50">
            Resume work across Discover, Create, Design, Video, Mail, Launch, and Autonomous — all in one place.
          </p>
        </div>
        <SaveDraftButton />
      </div>

      {loading ? (
        <div className="text-theme-muted/40 text-sm">Loading drafts...</div>
      ) : drafts.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText size={40} className="mx-auto text-theme-muted/20 mb-4" />
          <p className="text-theme-muted/50 mb-4">No drafts yet. Work in any Curi module and click Save Draft to keep your progress.</p>
          <button type="button" onClick={() => navigate('/discover')} className="btn-primary text-sm">
            Start Core Workflow
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft, i) => (
            <motion.div
              key={draft._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`card p-5 flex items-center gap-4 ${
                activeDraftId === draft._id ? 'border-curi-pink/40 bg-curi-pink/5' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-curi-gradient flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-theme-text truncate">{draft.title}</div>
                <div className="text-xs text-theme-muted/40 mt-0.5">
                  {STEP_LABELS[draft.currentStep] || draft.currentStep}
                  {' · '}
                  {moduleSummary(draft)}
                </div>
                <div className="text-[10px] text-theme-muted/30 mt-1">
                  Updated {new Date(draft.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button type="button" onClick={() => remove(draft._id)} className="p-2 rounded-lg hover:bg-red-500/10 text-theme-muted/40 hover:text-red-400" title="Delete">
                  <Trash2 size={16} />
                </button>
                <button type="button" onClick={() => resume(draft)} className="btn-primary text-sm flex items-center gap-1.5">
                  Resume <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
