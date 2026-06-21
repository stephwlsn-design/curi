import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function Trends() {
  const { workspaceId, workspace } = useAuth()
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [trends, setTrends] = useState([])

  useEffect(() => {
    if (workspace?.brandProfile?.industry) {
      setIndustry(workspace.brandProfile.industry)
    }
  }, [workspace?.brandProfile?.industry])

  const scan = async () => {
    if (!workspaceId) return toast.error('Select a workspace first')
    setLoading(true)
    try {
      const { data } = await API.post('/trends/scan', { workspaceId, industry })
      setTrends(data.trends || [])
      toast.success(`Found ${data.trends?.length || 0} trending topics`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Trend scan failed')
    } finally { setLoading(false) }
  }

  const saveTrends = async () => {
    if (!trends.length) return
    setSaving(true)
    try {
      const { data } = await API.post('/trends/save', { workspaceId, trends, industry })
      toast.success(data.message || 'Trends saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save trends')
    } finally { setSaving(false) }
  }

  return (
    <PageShell>
      <PageHeader
        title="Curi Trends"
        description="Discover viral topics and content ideas tailored to your brand and industry."
      />

      <div className="page-card mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="section-label mb-2">Industry</div>
          <input className="input" placeholder="E.g. SaaS, DTC skincare, fintech..." value={industry} onChange={e => setIndustry(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-theme-muted/50 self-center">3 credits</span>
          <button onClick={scan} disabled={loading || !workspaceId} className="btn-primary flex-shrink-0 text-base px-6 py-3">
            {loading ? 'Scanning...' : 'Scan Trends'}
          </button>
        </div>
      </div>

      {trends.length > 0 && (
        <>
          <div className="flex justify-end mb-4">
            <button type="button" onClick={saveTrends} disabled={saving} className="btn-secondary text-sm">
              {saving ? 'Saving…' : 'Save trends'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {trends.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="page-card">
                <div className="flex justify-between items-start mb-3">
                  <span className="badge bg-curi-yellow/15 text-curi-yellow capitalize">{t.platform}</span>
                  <span className="text-base font-black text-curi-pink">{t.relevance}%</span>
                </div>
                <h3 className="font-bold text-theme-text text-lg mb-2">{t.topic}</h3>
                <p className="text-theme-muted/60 text-base mb-3">{t.contentIdea}</p>
                {t.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {t.hashtags.map((h, j) => (
                      <span key={j} className="text-sm text-curi-blue font-medium">#{h.replace(/^#/, '')}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}
