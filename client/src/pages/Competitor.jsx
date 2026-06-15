import { useState } from 'react'
import { API, useAuth } from '../context/AuthContext'
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
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Competitor Watch</h1>
        <p className="text-theme-muted/50">Analyze competitor content strategy, identify gaps, and get actionable recommendations to outperform them.</p>
      </div>

      <div className="card p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Competitor URL</div>
            <input className="input" placeholder="https://competitor.com" value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} />
          </div>
          <div>
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Or Name</div>
            <input className="input" placeholder="Competitor brand name" value={competitorName} onChange={e => setCompetitorName(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-theme-muted/40">10 credits</span>
          <button onClick={analyze} disabled={loading} className="btn-primary">
            {loading ? 'Analyzing...' : 'Analyze Competitor'}
          </button>
        </div>
      </div>

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card p-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-theme-text">{analysis.competitor}</h2>
              <p className="text-theme-muted/50 text-sm mt-1">Competitive intelligence report</p>
            </div>
            <div className="text-3xl font-black text-curi-pink">{analysis.score}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-xs font-semibold text-curi-green uppercase tracking-wider mb-3">Strengths</div>
              <ul className="space-y-2">
                {(analysis.strengths || []).map((s, i) => (
                  <li key={i} className="text-sm text-theme-muted/70 flex gap-2"><span className="text-curi-green font-bold">+</span>{s}</li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-curi-pink uppercase tracking-wider mb-3">Weaknesses</div>
              <ul className="space-y-2">
                {(analysis.weaknesses || []).map((w, i) => (
                  <li key={i} className="text-sm text-theme-muted/70 flex gap-2"><span className="text-curi-pink font-bold">-</span>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.contentStrategy && (
            <div className="card p-4">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Content Strategy</div>
              <p className="text-sm text-theme-muted/70">{analysis.contentStrategy}</p>
            </div>
          )}

          {(analysis.recommendations || []).length > 0 && (
            <div className="card p-4">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Recommendations</div>
              <div className="space-y-3">
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-curi-gradient text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{r.priority || i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm text-theme-text font-medium">{r.action}</p>
                      <span className={`text-xs font-bold capitalize ${r.impact === 'high' ? 'text-curi-green' : r.impact === 'medium' ? 'text-curi-yellow' : 'text-theme-muted/40'}`}>{r.impact} impact</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
