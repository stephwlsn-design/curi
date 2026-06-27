import { useState, useEffect, useCallback } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import LoadingMascot from '../components/LoadingMascot'

export default function Trends() {
  const { workspaceId, workspace, loading: authLoading } = useAuth()
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [trends, setTrends] = useState([])
  const [error, setError] = useState('')
  const [source, setSource] = useState('')

  const loadInitial = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError('')
    try {
      try {
        const { data: savedRes } = await API.get(`/trends/saved?workspaceId=${workspaceId}`, { timeout: 15000 })
        if (savedRes.trends?.length) {
          setTrends(savedRes.trends)
          if (savedRes.industry) setIndustry(savedRes.industry)
          setSource('saved')
          return
        }
      } catch { /* fall through to preview */ }

      const { data } = await API.get(`/trends/preview?workspaceId=${workspaceId}`, { timeout: 15000 })
      setTrends(data.trends || [])
      if (data.industry) setIndustry(data.industry)
      setSource(data.source || 'preview')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not load trends')
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

  const refreshWithAi = async () => {
    if (!workspaceId) return
    setRefreshing(true)
    setError('')
    try {
      const { data } = await API.post('/trends/scan', { workspaceId }, { timeout: 25000 })
      setTrends(data.trends || [])
      if (data.industry) setIndustry(data.industry)
      setSource(data.source || 'ai')
      if (data.warning) toast(data.warning, { icon: '⚠️' })
      else toast.success(`Updated with ${data.trends?.length || 0} trending topics`)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'AI scan failed'
      toast.error(msg)
      if (!trends.length) setError(msg)
    } finally {
      setRefreshing(false)
    }
  }

  const saveTrends = async () => {
    if (!trends.length) return
    setSaving(true)
    try {
      const { data } = await API.post('/trends/save', {
        workspaceId,
        trends,
        industry: industry || workspace?.brandProfile?.industry,
      })
      toast.success(data.message || 'Trends saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save trends')
    } finally { setSaving(false) }
  }

  const industryLabel = industry || workspace?.brandProfile?.industry || 'your industry'

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
        <PageHeader title="Curi Trends" description="Discover viral topics and content ideas tailored to your brand and industry." />
        <div className="page-card text-sm text-theme-muted/60">
          We couldn&apos;t load your workspace yet. Try refreshing or complete onboarding in Brand Hub first.
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Curi Trends"
        description="Discover viral topics and content ideas tailored to your brand and industry."
      />

      <div className="page-card mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          <p className="text-sm text-theme-muted/60">
            Trends for <span className="font-semibold text-theme-text">{industryLabel}</span>
            {workspace?.brandProfile?.name ? ` · ${workspace.brandProfile.name}` : ''}
          </p>
          <p className="text-xs text-theme-muted/45 mt-1">
            {refreshing ? 'Running live AI scan…' : 'Loaded from your Brand Hub profile — no input needed.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshWithAi}
            disabled={refreshing || loading}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {refreshing ? 'Scanning…' : 'Live AI scan'}
          </button>
          <span className="text-sm text-theme-muted/50">3 credits</span>
        </div>
      </div>

      {loading && (
        <div className="page-card flex flex-col items-center justify-center gap-3 py-16 text-theme-muted/60">
          <Loader2 size={24} className="animate-spin text-curi-pink" />
          <span className="text-sm font-medium">Loading trends for your brand…</span>
        </div>
      )}

      {error && !loading && trends.length === 0 && (
        <div className="page-card text-center py-12">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button type="button" onClick={loadInitial} className="btn-primary text-sm">Try again</button>
        </div>
      )}

      {!loading && trends.length > 0 && (
        <>
          <div className="flex justify-end mb-4 gap-2">
            <button type="button" onClick={loadInitial} disabled={loading || refreshing} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={14} /> Reload
            </button>
            <button type="button" onClick={saveTrends} disabled={saving} className="btn-secondary text-sm">
              {saving ? 'Saving…' : 'Save trends'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {trends.map((t, i) => (
              <motion.div key={t._id || `${t.topic}-${i}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="page-card">
                <div className="flex justify-between items-start mb-3">
                  <span className="badge bg-curi-yellow/15 text-curi-yellow capitalize">{t.platform}</span>
                  <span className="text-base font-black text-curi-pink">{t.relevance}%</span>
                </div>
                <h3 className="font-bold text-theme-text text-lg mb-2">{t.topic}</h3>
                <p className="text-theme-muted/60 text-base mb-3">{t.contentIdea}</p>
                {t.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {t.hashtags.map((h, j) => (
                      <span key={j} className="text-sm text-curi-blue font-medium">#{String(h).replace(/^#/, '')}</span>
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
