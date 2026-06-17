import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import { motion } from 'framer-motion'

export default function Analytics() {
  const { workspaceId } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/analytics?workspaceId=${workspaceId}`).then(r => setStats(r.data.stats)).catch(() => {})
  }, [workspaceId])

  const cards = stats ? [
    { label: 'Posts Generated', value: stats.postsGenerated, color: 'text-curi-pink' },
    { label: 'Images Created', value: stats.imagesCreated, color: 'text-curi-blue' },
    { label: 'Videos Made', value: stats.videosMade, color: 'text-curi-green' },
    { label: 'Published', value: stats.published, color: 'text-curi-yellow' },
    { label: 'Scheduled', value: stats.scheduled, color: 'text-curi-blue' },
    { label: 'Autonomous Runs', value: stats.autonomousRuns, color: 'text-curi-pink' },
  ] : []

  return (
    <PageShell>
      <PageHeader
        title="Performance Tracking"
        description="Track content output, publishing queue, and autonomous campaign performance."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
        {cards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="page-card">
            <div className={`text-3xl font-black ${s.color} mb-0.5`}>{s.value ?? 0}</div>
            <div className="text-theme-muted/50 text-sm font-medium">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="page-card">
        <div className="section-label mb-3">Learning Engine</div>
        <p className="text-theme-muted/60 text-base leading-relaxed">
          Every starred creative, approved post, and published asset updates your preferences.
          Future autonomous campaigns automatically prioritize your preferred styles, formats, and channels.
        </p>
      </div>
    </PageShell>
  )
}
