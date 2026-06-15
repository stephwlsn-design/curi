import { useState, useEffect } from 'react'
import { useAuth, API } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const MODULES = [
  { path: '/discover', label: 'Curi Discover', desc: 'Extract your brand DNA from any URL', color: 'from-curi-pink/20 to-curi-blue/20', badge: null },
  { path: '/create', label: 'Curi Create', desc: 'Generate posts for every platform', color: 'from-curi-blue/20 to-curi-yellow/20', badge: null },
  { path: '/design', label: 'Curi Design', desc: 'AI-generated on-brand creatives', color: 'from-curi-blue/20 to-curi-pink/20', badge: null },
  { path: '/video', label: 'Curi Video', desc: 'Product videos and social reels', color: 'from-curi-green/20 to-curi-blue/20', badge: null },
  { path: '/mail', label: 'Curi Mail', desc: 'Email flows and campaigns', color: 'from-curi-yellow/20 to-curi-green/20', badge: null },
  { path: '/launch', label: 'Curi Launch', desc: '20 posts + ads + emails in one click', color: 'from-curi-pink/20 to-curi-yellow/20', badge: 'HOT' },
  { path: '/autonomous', label: 'Autonomous Engine', desc: 'Generate your next 30 days automatically', color: 'from-curi-pink/20 to-curi-blue/20', badge: 'NEW' },
  { path: '/calendar', label: 'Curi Calendar', desc: '90-day auto content calendar', color: 'from-curi-blue/20 to-curi-yellow/20', badge: null },
  { path: '/repurpose', label: 'Curi Repurpose', desc: '1 blog to 10 formats instantly', color: 'from-curi-green/20 to-curi-blue/20', badge: null },
  { path: '/trends', label: 'Curi Trends', desc: 'Viral topics tailored to your brand', color: 'from-curi-yellow/20 to-curi-pink/20', badge: null },
  { path: '/competitor', label: 'Competitor Watch', desc: 'Track and outperform competitors', color: 'from-curi-blue/20 to-curi-green/20', badge: null },
]

const STATS_DEFAULT = [
  { label: 'Posts Generated', key: 'postsGenerated', color: 'text-curi-pink' },
  { label: 'Images Created', key: 'imagesCreated', color: 'text-curi-blue' },
  { label: 'Videos Made', key: 'videosMade', color: 'text-curi-green' },
  { label: 'Published', key: 'published', color: 'text-curi-yellow' },
]

export default function Dashboard() {
  const { user, workspaceId } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/analytics?workspaceId=${workspaceId}`).then(r => setStats(r.data.stats || {})).catch(() => {})
  }, [workspaceId])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-theme-text mb-1">{greeting}, {user?.name?.split(' ')[0]}</h1>
        <p className="text-theme-muted/50 font-medium">What are you creating today?</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {STATS_DEFAULT.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-5">
            <div className={`text-3xl font-black ${s.color} mb-0.5`}>{stats[s.key] ?? 0}</div>
            <div className="text-theme-muted/40 text-xs font-medium">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-theme-text">Curi Modules</h2>
        <span className="text-theme-muted/30 text-sm font-medium">{MODULES.length} agents</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MODULES.map((m, i) => (
          <motion.button
            key={m.path}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(m.path)}
            className="card p-5 text-left hover:border-theme-border hover:scale-[1.02] transition-all duration-200 group relative overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${m.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              {m.badge && (
                <span className={`badge mb-3 ${m.badge === 'HOT' ? 'bg-curi-pink/20 text-curi-pink' : 'bg-curi-blue/20 text-curi-blue'}`}>{m.badge}</span>
              )}
              <div className="font-bold text-theme-text text-sm mb-1">{m.label}</div>
              <div className="text-theme-muted/40 text-xs leading-relaxed font-medium">{m.desc}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 card p-5 bg-gradient-to-r from-curi-pink/10 to-curi-blue/10 border-curi-pink/20">
        <div className="flex items-center gap-4">
          <div className="w-1 h-12 rounded-full bg-curi-gradient flex-shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-theme-text text-sm mb-0.5">Autonomous Content Engine</div>
            <div className="text-theme-muted/50 text-xs font-medium">Generate your next 30 days — topics, strategy, content, designs, videos, scoring, and scheduling in one click.</div>
          </div>
          <button onClick={() => navigate('/autonomous')} className="btn-primary flex-shrink-0">Generate Next 30 Days</button>
        </div>
      </div>
    </div>
  )
}
