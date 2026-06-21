import { useNavigate } from 'react-router-dom'
import { useDraft } from '../../context/DraftContext'
import { FileText, ArrowRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../../context/AuthContext'

const STEP_LABELS = {
  discover: 'Discover',
  create: 'Create',
  design: 'Design',
  video: 'Video',
  mail: 'Mail',
  launch: 'Launch',
  autonomous: 'Autonomous',
}

export default function DraftLibraryGrid({ drafts, emptyMessage, onReload }) {
  const navigate = useNavigate()
  const { restoreDraft } = useDraft()

  const remove = async (id) => {
    try {
      await API.delete(`/drafts/${id}`)
      toast.success('Draft deleted')
      onReload?.()
    } catch {
      toast.error('Could not delete draft')
    }
  }

  if (!drafts.length) {
    return (
      <div className="page-card py-12 text-center">
        <FileText size={40} className="mx-auto text-theme-muted/20 mb-4" />
        <p className="text-theme-muted/60 text-sm">{emptyMessage || 'No workflow drafts saved yet.'}</p>
        <button type="button" onClick={() => navigate('/discover')} className="btn-secondary text-sm mt-4">
          Start a workflow
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {drafts.map((draft) => (
        <div key={draft._id} className="page-card flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-curi-gradient flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-theme-text text-sm truncate">{draft.title}</div>
            <div className="text-xs text-theme-muted/50 mt-0.5">
              {STEP_LABELS[draft.currentStep] || draft.currentStep}
              {' · '}
              Updated {draft.updatedAt && new Date(draft.updatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => remove(draft._id)}
              className="p-2 rounded-lg hover:bg-red-500/10 text-theme-muted/40 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => restoreDraft(draft)}
              className="btn-primary text-xs flex items-center gap-1"
            >
              Resume <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
