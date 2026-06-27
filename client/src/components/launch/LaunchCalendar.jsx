import { useMemo } from 'react'
import { motion } from 'framer-motion'

const PLATFORM_COLORS = {
  linkedin: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  twitter: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  facebook: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatRange = (start, end) => {
  if (!start || !end) return null
  const s = new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const e = new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${s} – ${e}`
}

export default function LaunchCalendar({ campaign }) {
  const posts = useMemo(() => {
    const items = (campaign?.content || [])
      .map((post) => ({
        ...post,
        scheduledAt: post.metadata?.suggestedScheduledAt || post.scheduledAt,
      }))
      .filter((post) => post.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

    return items
  }, [campaign])

  const byDate = useMemo(() => {
    const map = new Map()
    posts.forEach((post) => {
      const key = new Date(post.scheduledAt).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(post)
    })
    return [...map.entries()]
  }, [posts])

  const platformCounts = useMemo(() => {
    const counts = {}
    ;(campaign?.content || []).forEach((post) => {
      counts[post.platform] = (counts[post.platform] || 0) + 1
    })
    return counts
  }, [campaign])

  if (!campaign) return null

  return (
    <div className="space-y-5">
      <div className="page-card">
        <div className="section-label mb-3">Launch overview</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(campaign.platforms || []).map((platform) => (
            <span
              key={platform}
              className={`badge border capitalize ${PLATFORM_COLORS[platform] || 'bg-theme-subtle/10 text-theme-muted/60 border-theme-border'}`}
            >
              {platform}
              {platformCounts[platform] ? ` · ${platformCounts[platform]} posts` : ''}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-theme-subtle/5 p-3">
            <div className="text-theme-muted/50 text-xs uppercase font-bold mb-1">Duration</div>
            <div className="font-semibold text-theme-text">{campaign.timeline || '—'} days</div>
          </div>
          <div className="rounded-xl bg-theme-subtle/5 p-3">
            <div className="text-theme-muted/50 text-xs uppercase font-bold mb-1">Launch window</div>
            <div className="font-semibold text-theme-text">{formatRange(campaign.startDate, campaign.endDate) || 'Scheduling…'}</div>
          </div>
          <div className="rounded-xl bg-theme-subtle/5 p-3">
            <div className="text-theme-muted/50 text-xs uppercase font-bold mb-1">Posts queued</div>
            <div className="font-semibold text-theme-text">{campaign.content?.length || 0}</div>
          </div>
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="page-card">
          <div className="section-label mb-4">Publishing calendar</div>
          <div className="space-y-5">
            {byDate.map(([dateKey, dayPosts], groupIndex) => (
              <div key={dateKey}>
                <div className="text-sm font-bold text-theme-text mb-3">
                  {new Date(dateKey).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <div className="space-y-3">
                  {dayPosts.map((post, index) => (
                    <motion.div
                      key={post._id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (groupIndex + index) * 0.02 }}
                      className="flex gap-4 items-start rounded-xl border border-theme-subtle/10 bg-theme-subtle/5 p-4"
                    >
                      <div className="w-11 h-11 rounded-xl bg-curi-gradient flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                        {formatDate(post.scheduledAt).split(',')[1]?.trim().slice(0, 5) || '9:00'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`badge border capitalize text-xs ${PLATFORM_COLORS[post.platform] || ''}`}>
                            {post.platform}
                          </span>
                          {post.mediaUrl && (
                            <span className="badge bg-curi-green/15 text-curi-green text-xs">Design attached</span>
                          )}
                          <span className="text-xs text-theme-muted/50 ml-auto">{formatDate(post.scheduledAt)}</span>
                        </div>
                        <p className="text-theme-text text-sm line-clamp-3">{post.content}</p>
                        {post.hashtags?.length > 0 && (
                          <p className="text-xs text-curi-pink mt-1 truncate">
                            {post.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : campaign.status === 'generating' ? (
        <div className="page-card text-sm text-theme-muted/60">
          Building your publishing calendar… posts will appear here as they are generated.
        </div>
      ) : null}
    </div>
  )
}
