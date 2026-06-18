import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import DesignPreview from '../components/DesignPreview'
import DesignCanvasEditor from '../components/DesignCanvasEditor'
import VideoPreview from '../components/VideoPreview'
import { toDesignPreview, toVideoPreview } from '../utils/creative'

const TABS = [
  { id: 'review', label: 'Needs Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Drafts' },
]

const sourceLabel = (item) => {
  if (item.metadata?.module === 'autonomous') return 'Autonomous'
  if (item.metadata?.module === 'launch' || item.campaign) return 'Launch'
  return 'Create'
}

const formatSchedule = (value) => {
  if (!value) return null
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function Approvals() {
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('review')
  const [items, setItems] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [editingDesign, setEditingDesign] = useState(null)

  const load = useCallback(async (status) => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const { data } = await API.get(`/approvals/queue?workspaceId=${workspaceId}&status=${status}`, { timeout: 25000 })
      setItems(data.items || [])
      setStatusCounts(data.statusCounts || {})
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load approval queue')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { load(tab) }, [tab, load])

  const approve = async (id) => {
    try {
      const { data } = await API.post(`/approvals/approve/${id}`, { workspaceId })
      const scheduled = data.item?.status === 'scheduled'
      toast.success(scheduled ? 'Approved & scheduled' : 'Approved')
      load(tab)
    } catch {
      toast.error('Approve failed')
    }
  }

  const reject = async (id) => {
    try {
      await API.post(`/approvals/reject/${id}`, { reason: 'Needs revision', workspaceId })
      toast.success('Sent back to draft')
      load(tab)
    } catch {
      toast.error('Reject failed')
    }
  }

  const tabCount = (id) => statusCounts[id] ?? null

  const renderScheduleHint = (item) => {
    const when = item.metadata?.suggestedScheduledAt || item.scheduledAt
    if (!when || tab === 'draft') return null
    const label = tab === 'scheduled' || item.status === 'scheduled' ? 'Scheduled' : 'Suggested publish'
    return (
      <p className="text-xs text-curi-blue font-semibold">
        {label}: {formatSchedule(when)}
        {item.metadata?.suggestedPlatform && tab === 'review' && (
          <span className="text-theme-muted/50 font-medium"> · {item.metadata.suggestedPlatform}</span>
        )}
      </p>
    )
  }

  const renderActions = (id) => tab === 'review' && (
    <div className="flex gap-2 justify-end flex-shrink-0">
      <button type="button" onClick={() => approve(id)} className="btn-primary text-sm px-4 py-2">Approve</button>
      <button type="button" onClick={() => reject(id)} className="btn-secondary text-sm px-4 py-2">Reject</button>
    </div>
  )

  return (
    <PageShell>
      <PageHeader
        title="Approval Workflow"
        description="Review posts, designs, and videos from Autonomous and Launch. Approving applies the suggested publish date when available."
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {TABS.map(t => {
          const count = tabCount(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-xl text-base font-bold transition-all ${tab === t.id ? 'bg-curi-pink text-white' : 'bg-theme-subtle/5 text-theme-muted/60'}`}
            >
              {t.label}{count != null ? ` (${count})` : ''}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => load(tab)}
          disabled={loading}
          className="ml-auto btn-secondary text-sm px-3 py-2 flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="page-card text-center text-theme-muted/50 py-10 text-base">Loading queue…</div>
      ) : items.length === 0 ? (
        <div className="page-card text-center py-10 space-y-3">
          <p className="text-theme-muted/50 text-base">No items in this queue</p>
          {tab === 'review' && (
            <p className="text-sm text-theme-muted/45 max-w-md mx-auto">
              Run the Autonomous Engine and click <strong>Send to Approval Queue</strong>, or finish a Curi Launch campaign — posts will appear here for review.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button type="button" onClick={() => navigate('/autonomous')} className="btn-secondary text-sm">Autonomous</button>
            <button type="button" onClick={() => navigate('/launch')} className="btn-secondary text-sm">Launch</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {items.map((item, i) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="page-card"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-curi-blue/15 text-curi-blue text-[10px]">{sourceLabel(item)}</span>
                <span className="badge bg-theme-subtle/10 text-theme-muted/50 capitalize text-[10px]">{item.type}</span>
                {item.platform && (
                  <span className="badge bg-theme-subtle/10 text-theme-muted/50 capitalize text-[10px]">{item.platform}</span>
                )}
                {item.metadata?.creativeScore && (
                  <span className={`badge text-[10px] ${item.metadata.creativeScore.publishReady ? 'bg-curi-green/15 text-curi-green' : 'bg-curi-yellow/15 text-curi-yellow'}`}>
                    Score {item.metadata.creativeScore.overall}
                  </span>
                )}
              </div>

              {item.type === 'image' ? (
                <div className="space-y-4">
                  <DesignPreview design={toDesignPreview(item)} onEdit={setEditingDesign} />
                  {renderScheduleHint(item)}
                  {renderActions(item._id)}
                </div>
              ) : item.type === 'video' ? (
                <div className="space-y-4">
                  <VideoPreview video={toVideoPreview(item)} />
                  {renderScheduleHint(item)}
                  {renderActions(item._id)}
                </div>
              ) : (
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-theme-text text-base mb-1">{item.title || item.campaign?.name || 'Untitled'}</div>
                    {item.campaign?.goal && (
                      <p className="text-xs text-theme-muted/50 mb-2 line-clamp-1">{item.campaign.goal}</p>
                    )}
                    {renderScheduleHint(item)}
                    <p className="text-theme-muted/60 text-base line-clamp-6 whitespace-pre-wrap">{item.content}</p>
                    {item.hashtags?.length > 0 && (
                      <p className="text-xs text-curi-pink mt-2">{item.hashtags.map(h => `#${h}`).join(' ')}</p>
                    )}
                  </div>
                  {renderActions(item._id)}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {editingDesign && (
        <DesignCanvasEditor
          design={editingDesign}
          workspaceId={workspaceId}
          onClose={() => setEditingDesign(null)}
          onSaved={(updated) => {
            setItems(prev => prev.map(i => i._id === updated._id ? { ...i, metadata: { ...i.metadata, ...updated }, content: updated.headline } : i))
            setEditingDesign(null)
          }}
        />
      )}
    </PageShell>
  )
}
