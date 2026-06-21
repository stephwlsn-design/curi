import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { RefreshCw, Search, X, ChevronDown, ChevronRight, Eye, Pencil } from 'lucide-react'
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

const TYPE_OPTIONS = [
  { id: 'all', label: 'All types' },
  { id: 'post', label: 'Post' },
  { id: 'image', label: 'Design' },
  { id: 'video', label: 'Video' },
]

const SOURCE_OPTIONS = [
  { id: 'all', label: 'All sources' },
  { id: 'autonomous', label: 'Autonomous' },
  { id: 'launch', label: 'Launch' },
  { id: 'create', label: 'Create' },
]

const sourceKey = (item) => {
  if (item.metadata?.module === 'autonomous') return 'autonomous'
  if (item.metadata?.module === 'launch' || item.campaign) return 'launch'
  return 'create'
}

const sourceLabel = (item) => {
  const key = sourceKey(item)
  if (key === 'autonomous') return 'Autonomous'
  if (key === 'launch') return 'Launch'
  return 'Create'
}

const itemTitle = (item) => (
  item.title
  || item.metadata?.headline
  || item.metadata?.name
  || item.campaign?.name
  || 'Untitled'
)

const itemPreview = (item) => {
  const text = item.content || item.metadata?.headline || item.metadata?.hook || ''
  return text.replace(/\s+/g, ' ').trim()
}

const formatSchedule = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const matchesSearch = (item, query) => {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  const haystack = [
    itemTitle(item),
    itemPreview(item),
    item.type,
    item.platform,
    sourceLabel(item),
    item.campaign?.goal,
    item.campaign?.name,
    item.metadata?.module,
    item.metadata?.suggestedPlatform,
    ...(item.hashtags || []),
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

export default function Approvals() {
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('review')
  const [items, setItems] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [editingDesign, setEditingDesign] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

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

  useEffect(() => {
    setExpandedId(null)
    load(tab)
  }, [tab, load])

  const filteredItems = useMemo(() => items.filter((item) => {
    if (!matchesSearch(item, search)) return false
    if (typeFilter !== 'all' && item.type !== typeFilter) return false
    if (sourceFilter !== 'all' && sourceKey(item) !== sourceFilter) return false
    return true
  }), [items, search, typeFilter, sourceFilter])

  const filtersActive = search.trim() || typeFilter !== 'all' || sourceFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setSourceFilter('all')
  }

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

  const approveAll = async () => {
    if (!window.confirm('Approve and schedule all items with suggested publish dates?')) return
    try {
      const { data } = await API.post('/approvals/approve-all', { workspaceId })
      toast.success(data.message || `Scheduled ${data.scheduled} items`)
      load(tab)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk approve failed')
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

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const tabCount = (id) => statusCounts[id] ?? null

  const renderExpandedContent = (item) => {
    if (item.type === 'image') {
      return (
        <div className="max-w-sm">
          <DesignPreview design={toDesignPreview(item)} compact onEdit={setEditingDesign} />
        </div>
      )
    }
    if (item.type === 'video') {
      return (
        <div className="max-w-sm">
          <VideoPreview video={toVideoPreview(item)} />
        </div>
      )
    }
    return (
      <div className="max-w-2xl space-y-2">
        {item.campaign?.goal && (
          <p className="text-xs text-theme-muted/50">{item.campaign.goal}</p>
        )}
        <p className="text-sm text-theme-muted/70 whitespace-pre-wrap leading-relaxed">{item.content}</p>
        {item.hashtags?.length > 0 && (
          <p className="text-xs text-curi-pink">{item.hashtags.map((h) => `#${h}`).join(' ')}</p>
        )}
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Approval Workflow"
        description="Review, approve, or reject creatives in a single queue. Search by title, caption, platform, or source."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => {
          const count = tabCount(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-curi-pink text-white' : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'}`}
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
        {tab === 'review' && (statusCounts.review || 0) > 0 && (
          <button type="button" onClick={approveAll} className="btn-primary text-sm px-3 py-2">
            Approve & schedule all
          </button>
        )}
      </div>

      <div className="page-card mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted/40 pointer-events-none" />
            <input
              type="search"
              className="input pl-9 w-full"
              placeholder="Search approvals by title, caption, platform, source, hashtags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="input text-sm min-w-[130px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {TYPE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select
              className="input text-sm min-w-[140px]"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              {SOURCE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="btn-secondary text-sm flex items-center gap-1 px-3">
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>
        {!loading && (
          <p className="text-xs text-theme-muted/45">
            Showing {filteredItems.length} of {items.length} in {TABS.find((t) => t.id === tab)?.label.toLowerCase()}
            {filtersActive && ' (filtered)'}
          </p>
        )}
      </div>

      {loading ? (
        <div className="page-card text-center text-theme-muted/50 py-12 text-sm">Loading approval queue…</div>
      ) : filteredItems.length === 0 ? (
        <div className="page-card text-center py-12 space-y-3">
          <p className="text-theme-muted/50 text-sm">
            {items.length === 0 ? 'No items in this queue' : 'No approvals match your search'}
          </p>
          {items.length === 0 && tab === 'review' && (
            <p className="text-xs text-theme-muted/45 max-w-md mx-auto">
              Run Autonomous and click <strong>Send to Approval Queue</strong>, or finish a Curi Launch campaign.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {filtersActive ? (
              <button type="button" onClick={clearFilters} className="btn-primary text-sm">Clear search</button>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/autonomous')} className="btn-secondary text-sm">Autonomous</button>
                <button type="button" onClick={() => navigate('/launch')} className="btn-secondary text-sm">Launch</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="page-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-theme-border bg-theme-subtle/5">
                  <th className="w-8 px-3 py-3" aria-label="Expand" />
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider">
                    {tab === 'scheduled' ? 'Scheduled' : 'Publish date'}
                  </th>
                  <th className="px-4 py-3 font-bold text-theme-muted/50 text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const expanded = expandedId === item._id
                  const score = item.metadata?.creativeScore
                  const scheduleAt = item.metadata?.suggestedScheduledAt || item.scheduledAt
                  return (
                    <Fragment key={item._id}>
                      <tr
                        className={`border-b border-theme-border/60 hover:bg-theme-subtle/5 transition-colors ${expanded ? 'bg-theme-subtle/5' : ''}`}
                      >
                        <td className="px-3 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item._id)}
                            className="p-1 rounded text-theme-muted/50 hover:text-theme-text"
                            aria-label={expanded ? 'Collapse row' : 'Expand row'}
                          >
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-middle max-w-[280px]">
                          <div className="font-semibold text-theme-text truncate">{itemTitle(item)}</div>
                          <div className="text-xs text-theme-muted/50 truncate mt-0.5">{itemPreview(item) || '—'}</div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="badge bg-theme-subtle/10 text-theme-muted/60 capitalize text-[10px]">{item.type}</span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className={`badge text-[10px] ${sourceKey(item) === 'autonomous' ? 'bg-curi-pink/15 text-curi-pink' : sourceKey(item) === 'launch' ? 'bg-curi-blue/15 text-curi-blue' : 'bg-theme-subtle/10 text-theme-muted/50'}`}>
                            {sourceLabel(item)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle capitalize text-theme-muted/70">
                          {item.platform || item.metadata?.suggestedPlatform || '—'}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {score ? (
                            <span className={`badge text-[10px] ${score.publishReady ? 'bg-curi-green/15 text-curi-green' : 'bg-curi-yellow/15 text-curi-yellow'}`}>
                              {score.overall}
                            </span>
                          ) : (
                            <span className="text-theme-muted/35">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle text-theme-muted/60 text-xs whitespace-nowrap">
                          {formatSchedule(scheduleAt)}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleExpand(item._id)}
                              className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
                              title="Preview"
                            >
                              <Eye size={13} />
                              View
                            </button>
                            {item.type === 'image' && tab === 'review' && (
                              <button
                                type="button"
                                onClick={() => setEditingDesign(toDesignPreview(item))}
                                className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
                                title="Edit design"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {tab === 'review' && (
                              <>
                                <button type="button" onClick={() => approve(item._id)} className="btn-primary text-xs px-2.5 py-1.5">
                                  Approve
                                </button>
                                <button type="button" onClick={() => reject(item._id)} className="btn-secondary text-xs px-2.5 py-1.5">
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-theme-border/60 bg-theme-subtle/[0.03]">
                          <td colSpan={8} className="px-4 py-4">
                            {renderExpandedContent(item)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingDesign && (
        <DesignCanvasEditor
          design={editingDesign}
          workspaceId={workspaceId}
          onClose={() => setEditingDesign(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((i) => (
              i._id === updated._id
                ? { ...i, metadata: { ...i.metadata, ...updated }, content: updated.headline }
                : i
            )))
            setEditingDesign(null)
          }}
        />
      )}
    </PageShell>
  )
}
