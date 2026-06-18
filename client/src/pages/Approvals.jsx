import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
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

export default function Approvals() {
  const { workspaceId } = useAuth()
  const [tab, setTab] = useState('review')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingDesign, setEditingDesign] = useState(null)

  const load = async (status) => {
    setLoading(true)
    try {
      const { data } = await API.get(`/approvals/queue?workspaceId=${workspaceId}&status=${status}`)
      setItems(data.items || [])
    } catch {
      toast.error('Failed to load queue')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (workspaceId) load(tab) }, [workspaceId, tab])

  const approve = async (id) => {
    try {
      await API.post(`/approvals/approve/${id}`, { workspaceId })
      toast.success('Approved')
      load(tab)
    } catch { toast.error('Approve failed') }
  }

  const reject = async (id) => {
    try {
      await API.post(`/approvals/reject/${id}`, { reason: 'Needs revision', workspaceId })
      toast.success('Sent back to draft')
      load(tab)
    } catch { toast.error('Reject failed') }
  }

  return (
    <PageShell>
      <PageHeader
        title="Approval Workflow"
        description="Review, approve, or reject creatives before they publish. Only assets scoring above 80 auto-approve."
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-base font-bold transition-all ${tab === t.id ? 'bg-curi-pink text-white' : 'bg-theme-subtle/5 text-theme-muted/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-card text-center text-theme-muted/50 py-10 text-base">Loading...</div>
      ) : items.length === 0 ? (
        <div className="page-card text-center text-theme-muted/50 py-10 text-base">No items in this queue</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {items.map((item, i) => (
            <motion.div key={item._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="page-card">
              {item.type === 'image' ? (
                <div className="space-y-4">
                  <DesignPreview design={toDesignPreview(item)} onEdit={setEditingDesign} />
                  {item.metadata?.suggestedScheduledAt && tab === 'review' && (
                    <p className="text-xs text-curi-blue font-semibold">
                      Suggested publish: {new Date(item.metadata.suggestedScheduledAt).toLocaleString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  )}
                  {tab === 'review' && (
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => approve(item._id)} className="btn-primary text-sm px-4 py-2">Approve</button>
                      <button onClick={() => reject(item._id)} className="btn-secondary text-sm px-4 py-2">Reject</button>
                    </div>
                  )}
                </div>
              ) : item.type === 'video' ? (
                <div className="space-y-4">
                  <VideoPreview video={toVideoPreview(item)} />
                  {item.metadata?.suggestedScheduledAt && tab === 'review' && (
                    <p className="text-xs text-curi-blue font-semibold">
                      Suggested publish: {new Date(item.metadata.suggestedScheduledAt).toLocaleString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  )}
                  {tab === 'review' && (
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => approve(item._id)} className="btn-primary text-sm px-4 py-2">Approve</button>
                      <button onClick={() => reject(item._id)} className="btn-secondary text-sm px-4 py-2">Reject</button>
                    </div>
                  )}
                </div>
              ) : (
              <div className="flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-curi-blue/15 text-curi-blue capitalize">{item.type}</span>
                    <span className="badge bg-theme-subtle/10 text-theme-muted/50 capitalize">{item.platform}</span>
                    {item.metadata?.creativeScore && (
                      <span className={`badge ${item.metadata.creativeScore.publishReady ? 'bg-curi-green/15 text-curi-green' : 'bg-curi-yellow/15 text-curi-yellow'}`}>
                        Score {item.metadata.creativeScore.overall}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-theme-text text-base mb-1">{item.title || 'Untitled'}</div>
                  {item.metadata?.suggestedScheduledAt && tab === 'review' && (
                    <p className="text-xs text-curi-blue font-semibold mb-1">
                      Suggested publish: {new Date(item.metadata.suggestedScheduledAt).toLocaleString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                      {item.metadata.suggestedPlatform && (
                        <span className="text-theme-muted/50 font-medium"> · {item.metadata.suggestedPlatform}</span>
                      )}
                    </p>
                  )}
                  <p className="text-theme-muted/60 text-base line-clamp-3">{item.content}</p>
                </div>
                {tab === 'review' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => approve(item._id)} className="btn-primary text-xs px-4 py-2">Approve</button>
                    <button onClick={() => reject(item._id)} className="btn-secondary text-xs px-4 py-2">Reject</button>
                  </div>
                )}
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
