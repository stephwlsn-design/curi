import { motion } from 'framer-motion'
import { BarChart3, Eye, Heart, MessageCircle, Share2, MousePointerClick, TrendingUp } from 'lucide-react'

const PLATFORM_STYLES = {
  linkedin: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  twitter: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  facebook: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
}

const formatNum = (n) => {
  if (n == null) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function SocialEngagementStats({ stats, loading }) {
  if (loading) {
    return (
      <div className="page-card py-12 text-center text-sm text-theme-muted/50">
        Loading engagement statistics…
      </div>
    )
  }

  if (!stats) return null

  const totals = stats.totals || {}
  const summaryCards = [
    { label: 'Impressions', value: totals.impressions, icon: Eye, color: 'text-curi-blue' },
    { label: 'Reach', value: totals.reach, icon: TrendingUp, color: 'text-curi-green' },
    { label: 'Engagement', value: totals.engagement, icon: Heart, color: 'text-curi-pink' },
    { label: 'Comments', value: totals.comments, icon: MessageCircle, color: 'text-curi-yellow' },
    { label: 'Shares', value: totals.shares, icon: Share2, color: 'text-curi-blue' },
    { label: 'Clicks', value: totals.clicks, icon: MousePointerClick, color: 'text-curi-green' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="section-label mb-1">Brand engagement</div>
            <h2 className="text-xl font-bold text-theme-text">{stats.brandName}</h2>
            <p className="text-sm text-theme-muted/55 mt-1">
              Performance across connected social channels — last 28 days where platform data is available.
            </p>
          </div>
          <div className="badge bg-curi-green/15 text-curi-green">
            {totals.engagementRate || 0}% engagement rate
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-theme-subtle/5 border border-theme-subtle/10 p-4"
            >
              <card.icon size={16} className={`${card.color} mb-2`} />
              <div className={`text-2xl font-black ${card.color}`}>{formatNum(card.value)}</div>
              <div className="text-xs text-theme-muted/55 font-medium mt-1">{card.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="page-card">
        <div className="section-label mb-4">By platform</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(stats.platforms || []).map((platform, i) => (
            <motion.div
              key={platform.platform}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-theme-subtle/10 bg-theme-subtle/5 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <span className={`badge border capitalize ${PLATFORM_STYLES[platform.platform] || ''}`}>
                    {platform.platform}
                  </span>
                  <div className="text-sm font-semibold text-theme-text mt-2">
                    {platform.accountName || (platform.connected ? 'Connected' : 'Not connected')}
                  </div>
                </div>
                <div className="text-right text-xs text-theme-muted/50">
                  <div>{platform.publishedPosts} published</div>
                  <div>{platform.scheduledPosts} scheduled</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-theme-bg/50 p-2">
                  <div className="text-lg font-bold text-theme-text">{formatNum(platform.impressions)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-theme-muted/45">Impressions</div>
                </div>
                <div className="rounded-lg bg-theme-bg/50 p-2">
                  <div className="text-lg font-bold text-theme-text">{formatNum(platform.engagement)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-theme-muted/45">Engagement</div>
                </div>
                <div className="rounded-lg bg-theme-bg/50 p-2">
                  <div className="text-lg font-bold text-theme-text">{platform.engagementRate || 0}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-theme-muted/45">Rate</div>
                </div>
              </div>

              {platform.source === 'platform' && (
                <p className="text-[10px] text-curi-blue mt-3">Includes live data from platform API</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {stats.topPosts?.length > 0 && (
        <div className="page-card">
          <div className="flex items-center gap-2 section-label mb-4">
            <BarChart3 size={14} />
            Top performing posts
          </div>
          <div className="space-y-3">
            {stats.topPosts.map((post) => (
              <div key={post.id} className="flex gap-4 items-start rounded-xl border border-theme-subtle/10 bg-theme-subtle/5 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge border capitalize text-xs ${PLATFORM_STYLES[post.platform] || ''}`}>
                      {post.platform}
                    </span>
                    {post.publishedAt && (
                      <span className="text-xs text-theme-muted/45">
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-theme-text line-clamp-2">{post.content || post.title}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-curi-pink">{formatNum(post.engagement)}</div>
                  <div className="text-[10px] text-theme-muted/45 uppercase">Engagement</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
