import { useState } from 'react'
import { API, useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function Trends() {
  const { workspaceId, workspace } = useAuth()
  const [industry, setIndustry] = useState(workspace?.brandProfile?.industry || '')
  const [loading, setLoading] = useState(false)
  const [trends, setTrends] = useState([])

  const scan = async () => {
    setLoading(true)
    try {
      const { data } = await API.post('/trends/scan', { workspaceId, industry })
      setTrends(data.trends || [])
      toast.success(`Found ${data.trends?.length || 0} trending topics`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Trend scan failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Trends</h1>
        <p className="text-theme-muted/50">Discover viral topics and content ideas tailored to your brand and industry.</p>
      </div>

      <div className="card p-5 mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Industry</div>
          <input className="input" placeholder="E.g. SaaS, DTC skincare, fintech..." value={industry} onChange={e => setIndustry(e.target.value)} />
        </div>
        <button onClick={scan} disabled={loading} className="btn-primary flex-shrink-0">
          {loading ? 'Scanning...' : 'Scan Trends'}
        </button>
      </div>

      {trends.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {trends.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="card p-5">
              <div className="flex justify-between items-start mb-3">
                <span className="badge bg-curi-yellow/15 text-curi-yellow capitalize">{t.platform}</span>
                <span className="text-sm font-black text-curi-pink">{t.relevance}%</span>
              </div>
              <h3 className="font-bold text-theme-text mb-2">{t.topic}</h3>
              <p className="text-theme-muted/60 text-sm mb-3">{t.contentIdea}</p>
              {t.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.hashtags.map((h, j) => (
                    <span key={j} className="text-xs text-curi-blue font-medium">#{h.replace(/^#/, '')}</span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
