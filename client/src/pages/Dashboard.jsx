import { useState, useEffect } from 'react'
import { useAuth, API } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import BrandHubSection from '../components/brand/BrandHubSection'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp } from 'lucide-react'

const STAT_CARDS = [
  { label: 'Posts Generated', key: 'postsGenerated', color: 'text-curi-pink' },
  { label: 'Images Created', key: 'imagesCreated', color: 'text-curi-blue' },
  { label: 'Videos Made', key: 'videosMade', color: 'text-curi-green' },
  { label: 'Published', key: 'published', color: 'text-curi-yellow' },
  { label: 'Scheduled', key: 'scheduled', color: 'text-curi-blue' },
  { label: 'Autonomous Runs', key: 'autonomousRuns', color: 'text-curi-pink' },
]

const QUICK_START = [
  { path: '/discover', label: 'Discover', desc: 'Brand DNA' },
  { path: '/create', label: 'Create', desc: 'New post' },
  { path: '/design/studio', label: 'Design', desc: 'Creative' },
  { path: '/autonomous', label: 'Autonomous', desc: '30-day plan' },
]

export default function Dashboard() {
  const { user, workspaceId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [stats, setStats] = useState({})
  const [topContent, setTopContent] = useState([])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/analytics?workspaceId=${workspaceId}`)
      .then((r) => {
        setStats(r.data.stats || {})
        setTopContent(r.data.topContent || [])
      })
      .catch(() => {})
  }, [workspaceId])

  useEffect(() => {
    if (!location.hash.startsWith('#brand-hub')) return
    const el = document.getElementById('brand-hub')
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash, location.pathname])

  return (
    <PageShell>
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0]}`}
        description="Workspace overview — stats, performance, and all your saved brand assets."
      />

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-curi-pink" />
          <h2 className="text-lg font-bold text-theme-text">Statistics & analytics</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {STAT_CARDS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="page-card"
            >
              <div className={`text-2xl lg:text-3xl font-black ${s.color} mb-0.5`}>
                {stats[s.key] ?? 0}
              </div>
              <div className="text-theme-muted/50 text-xs lg:text-sm font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="page-card lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-curi-green" />
              <span className="text-sm font-bold text-theme-text">Top performing content</span>
            </div>
            {topContent.length > 0 ? (
              <ul className="space-y-2">
                {topContent.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm py-2 border-b border-theme-border/50 last:border-0">
                    <span className="font-medium text-theme-text truncate">{item.title || 'Untitled'}</span>
                    <span className="text-xs text-theme-muted/50 capitalize flex-shrink-0">
                      {item.platform || 'universal'}
                      {item.analytics?.impressions != null && ` · ${item.analytics.impressions} views`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-theme-muted/55">
                Publish content to start tracking performance. Curi learns from what you approve and ship.
              </p>
            )}
          </div>

          <div className="page-card">
            <div className="text-sm font-bold text-theme-text mb-3">Quick start</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_START.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="text-left p-3 rounded-xl border border-theme-border hover:border-curi-pink/30 hover:bg-curi-pink/5 transition-all"
                >
                  <div className="text-xs font-bold text-theme-text">{item.label}</div>
                  <div className="text-[10px] text-theme-muted/50">{item.desc}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="btn-secondary w-full text-xs mt-3"
            >
              Full analytics report
            </button>
          </div>
        </div>
      </section>

      <section id="brand-hub" className="scroll-mt-6 pt-2 border-t border-theme-border/60">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6 pt-8">
          <div>
            <h2 className="text-xl font-bold text-theme-text">Brand Hub</h2>
            <p className="text-sm text-theme-muted/55 mt-1 max-w-2xl">
              Brand colors, saved assets, workflow drafts, and social channel connections for publishing.
            </p>
          </div>
        </div>
        <BrandHubSection workspaceId={workspaceId} />
      </section>
    </PageShell>
  )
}
