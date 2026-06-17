import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { useDraft } from '../context/DraftContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { FileText, Trash2, ArrowRight } from 'lucide-react'
import { PageShell, PageHeader } from '../components/layout/PageShell'
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
    <PageShell>
      <PageHeader
        title="Saved Drafts"
        description="Resume work across Discover, Create, Design, Video, Mail, Launch, and Autonomous — all in one place."
        action={<SaveDraftButton />}
      />

      {loading ? (
        <div className="text-theme-muted/50 text-base">Loading drafts...</div>
      ) : drafts.length === 0 ? (
        <div className="page-card py-12 text-center">
          <FileText size={40} className="mx-auto text-theme-muted/20 mb-4" />
          <p className="text-theme-muted/60 text-base mb-4">No drafts yet. Work in any Curi module and click Save Draft to keep your progress.</p>
          <button type="button" onClick={() => navigate('/discover')} className="btn-primary text-base">
            Start Core Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {drafts.map((draft, i) => (
            <motion.div
              key={draft._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`page-card flex items-center gap-4 ${
                activeDraftId === draft._id ? 'border-curi-pink/40 bg-curi-pink/5' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-curi-gradient flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-theme-text text-base truncate">{draft.title}</div>
                <div className="text-sm text-theme-muted/50 mt-0.5">
                  {STEP_LABELS[draft.currentStep] || draft.currentStep}
                  {' · '}
                  {moduleSummary(draft)}
                </div>
                <div className="text-xs text-theme-muted/40 mt-1">
                  Updated {new Date(draft.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button type="button" onClick={() => remove(draft._id)} className="p-2 rounded-lg hover:bg-red-500/10 text-theme-muted/40 hover:text-red-400" title="Delete">
                  <Trash2 size={18} />
                </button>
                <button type="button" onClick={() => resume(draft)} className="btn-primary text-base flex items-center gap-1.5">
                  Resume <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
