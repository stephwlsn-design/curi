import { useState } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function Competitor() {
  const { workspaceId } = useAuth()
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [competitorName, setCompetitorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)

  const analyze = async () => {
    if (!competitorUrl.trim() && !competitorName.trim()) return toast.error('Enter a competitor URL or name')
    setLoading(true)
    try {
      const { data } = await API.post('/competitor/analyze', { workspaceId, competitorUrl, competitorName })
      setAnalysis(data.analysis)
      toast.success('Competitor analysis complete')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed')
    } finally { setLoading(false) }
  }

  return (
    <PageShell>
      <PageHeader
        title="Competitor Watch"
        description="Analyze competitor content strategy, identify gaps, and get actionable recommendations to outperform them."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div className="page-card">
          <div className="section-label mb-2">Competitor URL</div>
          <input className="input" placeholder="https://competitor.com" value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} />
        </div>
        <div className="page-card">
          <div className="section-label mb-2">Or Name</div>
          <input className="input" placeholder="Competitor brand name" value={competitorName} onChange={e => setCompetitorName(e.target.value)} />
        </div>
      </div>

      <div className="page-card mb-8">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <span className="text-sm text-theme-muted/50">10 credits</span>
          <button onClick={analyze} disabled={loading} className="btn-primary text-base px-6 py-3">
            {loading ? 'Analyzing...' : 'Analyze Competitor'}
          </button>
        </div>
      </div>

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="page-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-theme-text">{analysis.competitor}</h2>
              <p className="text-theme-muted/60 text-base mt-1">Competitive intelligence report</p>
            </div>
            <div className="text-4xl font-black text-curi-pink">{analysis.score}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="page-card">
              <div className="section-label text-curi-green mb-3">Strengths</div>
              <ul className="space-y-2">
                {(analysis.strengths || []).map((s, i) => (
                  <li key={i} className="text-base text-theme-muted/70 flex gap-2"><span className="text-curi-green font-bold">+</span>{s}</li>
                ))}
              </ul>
            </div>
            <div className="page-card">
              <div className="section-label text-curi-pink mb-3">Weaknesses</div>
              <ul className="space-y-2">
                {(analysis.weaknesses || []).map((w, i) => (
                  <li key={i} className="text-base text-theme-muted/70 flex gap-2"><span className="text-curi-pink font-bold">-</span>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.contentStrategy && (
            <div className="page-card">
              <div className="section-label mb-2">Content Strategy</div>
              <p className="text-base text-theme-muted/70">{analysis.contentStrategy}</p>
            </div>
          )}

          {(analysis.recommendations || []).length > 0 && (
            <div className="page-card">
              <div className="section-label mb-3">Recommendations</div>
              <div className="space-y-3">
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-7 h-7 rounded-full bg-curi-gradient text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{r.priority || i + 1}</span>
                    <div className="flex-1">
                      <p className="text-base text-theme-text font-medium">{r.action}</p>
                      <span className={`text-sm font-bold capitalize ${r.impact === 'high' ? 'text-curi-green' : r.impact === 'medium' ? 'text-curi-yellow' : 'text-theme-muted/50'}`}>{r.impact} impact</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </PageShell>
  )
}
