import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Calendar, Rocket, Zap, Clock, UserCheck, Sparkles, Search, SlidersHorizontal, X } from 'lucide-react'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import DesignPreview from '../components/DesignPreview'
import VideoPreview from '../components/VideoPreview'
import { toDesignPreview, toVideoPreview } from '../utils/creative'

const TABS = [
  { id: 'all', label: 'All Scheduled' },
  { id: 'launch', label: 'Curi Launch' },
  { id: 'autonomous', label: 'Autonomous' },
]

const PLATFORMS = [
  { id: 'all', label: 'All platforms' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'email', label: 'Email' },
  { id: 'universal', label: 'Universal' },
]

const POST_TYPES = [
  { id: 'all', label: 'All post types' },
  { id: 'post', label: 'Post' },
  { id: 'image', label: 'Image / Design' },
  { id: 'video', label: 'Video' },
  { id: 'email', label: 'Email' },
  { id: 'blog', label: 'Blog' },
  { id: 'ad', label: 'Ad' },
]

const CONTENT_TYPES = [
  { id: 'all', label: 'All content types' },
  { id: 'post', label: 'Text post' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'story', label: 'Story' },
  { id: 'reel', label: 'Reel' },
  { id: 'social_post', label: 'Social post' },
  { id: 'ad_creative', label: 'Ad creative' },
  { id: 'with-design', label: 'Has design' },
  { id: 'with-video', label: 'Has video' },
  { id: 'with-both', label: 'Design + video' },
]

const EMPTY_FILTERS = {
  search: '',
  dateFrom: '',
  dateTo: '',
  postType: 'all',
  contentType: 'all',
  platform: 'all',
}

const matchesSearch = (post, query) => {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  const haystack = [
    post.title,
    post.content,
    post.campaignName,
    post.runLabel,
    post.platform,
    post.type,
    post.contentFormat,
    post.design?.title,
    post.design?.headline,
    post.video?.title,
    post.video?.hook,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

const matchesDate = (post, from, to) => {
  if (!from && !to) return true
  if (!post.scheduledAt) return false
  const d = new Date(post.scheduledAt)
  if (from && d < new Date(`${from}T00:00:00`)) return false
  if (to && d > new Date(`${to}T23:59:59.999`)) return false
  return true
}

const matchesPostType = (post, postType) => postType === 'all' || post.type === postType

const matchesContentType = (post, contentType) => {
  if (contentType === 'all') return true
  const hasDesign = !!post.design
  const hasVideo = !!post.video
  if (contentType === 'with-design') return hasDesign
  if (contentType === 'with-video') return hasVideo
  if (contentType === 'with-both') return hasDesign && hasVideo
  const format = (post.contentFormat || post.type || '').toLowerCase()
  return format === contentType
}

const matchesPlatform = (post, platform) => platform === 'all' || post.platform === platform

const hasActiveFilters = (filters) => (
  filters.search.trim()
  || filters.dateFrom
  || filters.dateTo
  || filters.postType !== 'all'
  || filters.contentType !== 'all'
  || filters.platform !== 'all'
)

const SOURCE_META = {
  launch: { label: 'Launch', icon: Rocket, className: 'bg-curi-blue/15 text-curi-blue' },
  autonomous: { label: 'Autonomous', icon: Zap, className: 'bg-curi-pink/15 text-curi-pink' },
  other: { label: 'Other', icon: Clock, className: 'bg-theme-subtle/10 text-theme-muted/50' },
}

const SCORE_LABELS = [
  { key: 'brandAlignment', alt: 'brand', label: 'Brand' },
  { key: 'visualAppeal', alt: 'engagement', label: 'Visual' },
  { key: 'ctrPrediction', alt: 'conversion', label: 'CTR' },
  { key: 'engagementPrediction', alt: 'platform', label: 'Engage' },
]

const formatWhen = (dateStr) => {
  if (!dateStr) return 'TBD'
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr)
  const time = format(d, 'h:mm a')
  if (isToday(d)) return `Today at ${time}`
  if (isTomorrow(d)) return `Tomorrow at ${time}`
  return format(d, 'EEE, MMM d · h:mm a')
}

const groupByDate = (posts) => {
  const groups = {}
  posts.forEach(p => {
    if (!p.scheduledAt) return
    const key = format(new Date(p.scheduledAt), 'yyyy-MM-dd')
    if (!groups[key]) groups[key] = { label: format(new Date(p.scheduledAt), 'EEEE, MMMM d, yyyy'), posts: [] }
    groups[key].posts.push(p)
  })
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

const scoreValue = (score, key, alt) => score?.[key] ?? score?.[alt]

const CreativeScoreBar = ({ score, compact }) => {
  if (!score?.overall) return null
  const ready = score.publishReady
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex items-center gap-2">
        <span className={`badge text-[10px] ${ready ? 'bg-curi-green/15 text-curi-green' : 'bg-curi-yellow/15 text-curi-yellow'}`}>
          Score {score.overall}
        </span>
        {ready && <span className="text-[10px] text-curi-green">Publish ready</span>}
      </div>
      {!compact && (
        <div className="grid grid-cols-4 gap-1">
          {SCORE_LABELS.map(({ key, alt, label }) => {
            const v = scoreValue(score, key, alt)
            if (v == null) return null
            return (
              <div key={key} className="bg-theme-subtle/5 rounded-lg py-1 text-center">
                <div className="text-xs font-bold text-curi-pink">{v}</div>
                <div className="text-[10px] text-theme-muted/40">{label}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ApprovalLine = ({ approval, fallback }) => {
  const info = approval || fallback
  if (!info) return <span className="text-[10px] text-theme-muted/30">Not individually approved</span>
  const isAuto = info.type === 'auto'
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-theme-muted/50 mt-1">
      {isAuto ? <Sparkles size={12} className="text-curi-pink" /> : <UserCheck size={12} className="text-curi-blue" />}
      <span>
        {isAuto ? info.label || `Approved by ${info.name}` : `Approved by ${info.name}`}
        {info.at && ` · ${format(new Date(info.at), 'MMM d, h:mm a')}`}
        {!approval && fallback && ' (via post)'}
      </span>
    </div>
  )
}

export default function Scheduled() {
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [allPosts, setAllPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(true)

  const load = async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const { data } = await API.get(`/scheduled?workspaceId=${workspaceId}&source=all`)
      setAllPosts(data.posts || [])
    } catch {
      toast.error('Could not load scheduled posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [workspaceId])

  const counts = useMemo(() => ({
    all: allPosts.length,
    launch: allPosts.filter(p => p.source === 'launch').length,
    autonomous: allPosts.filter(p => p.source === 'autonomous').length,
  }), [allPosts])

  const posts = useMemo(() => {
    let result = tab === 'all' ? allPosts : allPosts.filter(p => p.source === tab)
    result = result.filter(p => (
      matchesSearch(p, filters.search)
      && matchesDate(p, filters.dateFrom, filters.dateTo)
      && matchesPostType(p, filters.postType)
      && matchesContentType(p, filters.contentType)
      && matchesPlatform(p, filters.platform)
    ))
    return result
  }, [allPosts, tab, filters])

  const grouped = useMemo(() => groupByDate(posts), [posts])

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)
  const filtersActive = hasActiveFilters(filters)

  const cancel = async (jobId) => {
    if (!jobId) return toast.error('Cannot cancel — no publish job linked')
    try {
      await API.delete(`/scheduled/${jobId}?workspaceId=${workspaceId}`)
      toast.success('Schedule cancelled')
      load()
    } catch {
      toast.error('Could not cancel')
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Scheduled Posts"
        description="Upcoming publishes with creative snapshots, scores, and approval details."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/launch')} className="btn-secondary text-base">Launch</button>
            <button type="button" onClick={() => navigate('/autonomous')} className="btn-secondary text-base">Autonomous</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-base font-bold transition-all ${
              tab === t.id ? 'bg-curi-gradient text-white' : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">({counts[t.id] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="page-card mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted/40" />
            <input
              type="search"
              className="input pl-9 w-full"
              placeholder="Search posts by title, caption, campaign, platform..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showFilters ? 'ring-1 ring-curi-pink/30' : ''}`}
            >
              <SlidersHorizontal size={14} />
              Filters
              {filtersActive && <span className="w-2 h-2 rounded-full bg-curi-pink" />}
            </button>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="btn-secondary text-sm flex items-center gap-1">
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 border-t border-theme-subtle/10">
            <div>
              <label className="label text-[10px] text-theme-muted/40 mb-1">From date</label>
              <input
                type="date"
                className="input w-full text-sm"
                value={filters.dateFrom}
                onChange={e => updateFilter('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <label className="label text-[10px] text-theme-muted/40 mb-1">To date</label>
              <input
                type="date"
                className="input w-full text-sm"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={e => updateFilter('dateTo', e.target.value)}
              />
            </div>
            <div>
              <label className="label text-[10px] text-theme-muted/40 mb-1">Post type</label>
              <select
                className="input w-full text-sm"
                value={filters.postType}
                onChange={e => updateFilter('postType', e.target.value)}
              >
                {POST_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-[10px] text-theme-muted/40 mb-1">Content type</label>
              <select
                className="input w-full text-sm"
                value={filters.contentType}
                onChange={e => updateFilter('contentType', e.target.value)}
              >
                {CONTENT_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-[10px] text-theme-muted/40 mb-1">Platform</label>
              <select
                className="input w-full text-sm"
                value={filters.platform}
                onChange={e => updateFilter('platform', e.target.value)}
              >
                {PLATFORMS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {!loading && (
          <div className="text-xs text-theme-muted/40">
            Showing {posts.length} of {tab === 'all' ? allPosts.length : allPosts.filter(p => p.source === tab).length} scheduled posts
            {filtersActive && ' (filtered)'}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-theme-muted/40 text-sm">Loading scheduled posts...</div>
      ) : posts.length === 0 ? (
        <div className="card p-10 text-center">
          <Calendar size={40} className="mx-auto text-theme-muted/20 mb-4" />
          <p className="text-theme-muted/50 mb-4">
            {allPosts.length === 0 ? 'No scheduled posts yet.' : 'No posts match your search or filters.'}
          </p>
          <p className="text-sm text-theme-muted/40 mb-6">
            {allPosts.length === 0
              ? 'Run Curi Launch or the Autonomous Engine to auto-schedule campaigns, or schedule content from Approvals.'
              : 'Try adjusting your search terms or clearing filters to see more results.'}
          </p>
          <div className="flex gap-3 justify-center">
            {filtersActive ? (
              <button type="button" onClick={clearFilters} className="btn-primary text-sm">Clear filters</button>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/launch')} className="btn-primary text-sm">Go to Launch</button>
                <button type="button" onClick={() => navigate('/autonomous')} className="btn-secondary text-sm">Go to Autonomous</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([key, group]) => (
            <div key={key}>
              <div className="section-label mb-3 flex items-center gap-2">
                <Calendar size={14} />
                {group.label}
              </div>
              <div className="space-y-4">
                {group.posts.map((post, i) => {
                  const meta = SOURCE_META[post.source] || SOURCE_META.other
                  const Icon = meta.icon
                  const hasCreatives = post.design || post.video

                  return (
                    <motion.div
                      key={post._id || post.jobId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="card p-5 space-y-4"
                    >
                      <div className="flex gap-4 items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`badge text-[10px] flex items-center gap-1 ${meta.className}`}>
                              <Icon size={10} /> {meta.label}
                            </span>
                            <span className="badge bg-theme-subtle/10 text-theme-muted/50 capitalize text-[10px]">{post.platform}</span>
                            <span className="badge bg-theme-subtle/10 text-theme-muted/50 capitalize text-[10px]">{post.type}</span>
                            {post.calendarDay && (
                              <span className="badge bg-curi-yellow/15 text-curi-yellow text-[10px]">Day {post.calendarDay}</span>
                            )}
                            {post.contentFormat && (
                              <span className="badge bg-curi-blue/10 text-curi-blue text-[10px] capitalize">{post.contentFormat.replace(/_/g, ' ')}</span>
                            )}
                          </div>
                          <div className="font-bold text-theme-text text-sm mb-0.5">{post.title}</div>
                          {(post.campaignName || post.runLabel) && (
                            <div className="text-[10px] text-theme-muted/40 mb-1">
                              {post.campaignName && `Campaign: ${post.campaignName}`}
                              {post.campaignName && post.runLabel && ' · '}
                              {post.runLabel && post.runLabel}
                            </div>
                          )}
                          <p className="text-sm text-theme-muted/60 line-clamp-3">{post.content}</p>
                          <div className="text-xs text-curi-green font-semibold mt-2 flex items-center gap-1">
                            <Clock size={12} />
                            {formatWhen(post.scheduledAt)}
                          </div>
                        </div>
                        {post.jobId && (
                          <button
                            type="button"
                            onClick={() => cancel(post.jobId)}
                            className="text-xs text-theme-muted/40 hover:text-red-400 flex-shrink-0"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {(hasCreatives || post.creativeScore || post.approval) && (
                        <div className="border-t border-theme-subtle/10 pt-4">
                          <div className="text-[10px] font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">
                            Creative Package
                          </div>
                          <div className={`grid gap-4 ${hasCreatives ? 'lg:grid-cols-[1fr_1fr_220px]' : 'lg:grid-cols-[220px]'}`}>
                            {post.design && (
                              <div>
                                <div className="text-[10px] text-theme-muted/40 mb-1.5 font-semibold">Design</div>
                                <div className="max-w-[200px]">
                                  <DesignPreview design={toDesignPreview(post.design)} compact />
                                </div>
                                {post.design.creativeScore && (
                                  <div className="mt-2">
                                    <CreativeScoreBar score={post.design.creativeScore} compact />
                                  </div>
                                )}
                                <ApprovalLine approval={post.design.approval} fallback={post.approval} />
                              </div>
                            )}
                            {post.video && (
                              <div>
                                <div className="text-[10px] text-theme-muted/40 mb-1.5 font-semibold">Video</div>
                                <div className="max-w-[220px]">
                                  <VideoPreview video={toVideoPreview(post.video)} compact />
                                </div>
                                {post.video.creativeScore && (
                                  <div className="mt-2">
                                    <CreativeScoreBar score={post.video.creativeScore} compact />
                                  </div>
                                )}
                                <ApprovalLine approval={post.video.approval} fallback={post.approval} />
                              </div>
                            )}
                            <div>
                              <div className="text-[10px] text-theme-muted/40 mb-1.5 font-semibold">Post Score & Approval</div>
                              <CreativeScoreBar score={post.creativeScore} />
                              <div className="mt-3">
                                <ApprovalLine approval={post.approval} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
