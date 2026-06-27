import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import LoadingMascot from '../components/LoadingMascot'

export default function Competitor() {
  const { workspaceId, workspace, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [activeCompetitor, setActiveCompetitor] = useState('')
  const [profileCompetitors, setProfileCompetitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [scraped, setScraped] = useState(false)
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [competitorName, setCompetitorName] = useState('')
  const [error, setError] = useState('')

  const applyAnalysisPayload = (data, nameOverride) => {
    setAnalysis(data.analysis)
    setScraped(Boolean(data.scraped))
    setCompetitorUrl(data.competitorUrl || '')
    setCompetitorName(data.competitorName || data.analysis?.competitor || '')
    setActiveCompetitor(data.competitorName || data.analysis?.competitor || nameOverride || '')
    if (data.competitors?.length) setProfileCompetitors(data.competitors)
  }

  const loadInitial = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError('')
    try {
      try {
        const { data: savedRes } = await API.get(`/competitor/saved?workspaceId=${workspaceId}`, { timeout: 15000 })
        if (savedRes.analysis) {
          applyAnalysisPayload(savedRes)
          return
        }
        if (savedRes.competitors?.length) setProfileCompetitors(savedRes.competitors)
      } catch { /* fall through to preview */ }

      const { data } = await API.get(`/competitor/preview?workspaceId=${workspaceId}`, { timeout: 15000 })
      applyAnalysisPayload(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not load competitor analysis')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (authLoading) return
    if (!workspaceId) {
      setLoading(false)
      return
    }
    loadInitial()
  }, [authLoading, workspaceId, loadInitial])

  const refreshWithAi = async (nameOverride) => {
    if (!workspaceId) return
    setRefreshing(true)
    setError('')
    try {
      const payload = { workspaceId }
      if (nameOverride) payload.competitorName = nameOverride

      const { data } = await API.post('/competitor/analyze', payload, { timeout: 30000 })
      applyAnalysisPayload(data, nameOverride)
      if (data.warning) toast(data.warning, { icon: '⚠️' })
      else toast.success(data.scraped ? 'Live analysis complete (site scraped)' : 'Live analysis complete')
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Analysis failed'
      toast.error(msg)
      if (!analysis) setError(msg)
    } finally {
      setRefreshing(false)
    }
  }

  const saveAnalysis = async () => {
    if (!analysis) return
    setSaving(true)
    try {
      const { data } = await API.post('/competitor/save', {
        workspaceId,
        analysis,
        competitorUrl,
        competitorName,
      })
      toast.success(data.message || 'Saved')
      navigate('/dashboard#brand-hub')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const competitors = profileCompetitors.length
    ? profileCompetitors
    : (workspace?.brandProfile?.competitors || workspace?.onboarding?.competitors || [])

  const targetLabel = activeCompetitor || competitorName || competitors[0] || 'your top competitor'

  if (authLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <LoadingMascot size="lg" />
        </div>
      </PageShell>
    )
  }

  if (!workspaceId) {
    return (
      <PageShell>
        <PageHeader title="Competitor Watch" description="Analyze competitor content strategy, identify gaps, and get actionable recommendations to outperform them." />
        <div className="page-card text-sm text-theme-muted/60">
          We couldn&apos;t load your workspace yet. Try refreshing or complete onboarding in Brand Hub first.
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Competitor Watch"
        description="Analyze competitor content strategy, identify gaps, and get actionable recommendations to outperform them."
      />

      <div className="page-card mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          <p className="text-sm text-theme-muted/60">
            Report for <span className="font-semibold text-theme-text">{targetLabel}</span>
            {workspace?.brandProfile?.name ? ` vs ${workspace.brandProfile.name}` : ''}
          </p>
          <p className="text-xs text-theme-muted/45 mt-1">
            {refreshing ? 'Running live AI analysis…' : 'Loaded from your Brand Hub profile — no input needed.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refreshWithAi(activeCompetitor || undefined)}
            disabled={refreshing || loading}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {refreshing ? 'Analyzing…' : 'Live AI analysis'}
          </button>
          <span className="text-sm text-theme-muted/50">
            10 credits {scraped ? '· scraped' : ''}
          </span>
        </div>
      </div>

      {competitors.length > 1 && (
        <div className="page-card mb-5">
          <div className="section-label mb-2">Other competitors in your profile</div>
          <div className="flex flex-wrap gap-2">
            {competitors.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => refreshWithAi(name)}
                disabled={refreshing || loading}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  activeCompetitor === name
                    ? 'bg-curi-pink/15 text-curi-pink'
                    : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="page-card flex flex-col items-center justify-center gap-3 py-16 text-theme-muted/60">
          <Loader2 size={24} className="animate-spin text-curi-pink" />
          <span className="text-sm font-medium">Loading competitive intelligence…</span>
        </div>
      )}

      {error && !loading && !analysis && (
        <div className="page-card text-center py-12">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button type="button" onClick={loadInitial} className="btn-primary text-sm">Try again</button>
        </div>
      )}

      {!loading && analysis && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={loadInitial} disabled={loading || refreshing} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={14} /> Reload
            </button>
            <button type="button" onClick={saveAnalysis} disabled={saving} className="btn-secondary text-sm">
              {saving ? 'Saving…' : 'Save to Brand Hub drafts'}
            </button>
          </div>
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
