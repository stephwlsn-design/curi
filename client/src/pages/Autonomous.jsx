import { useState, useEffect, useCallback, useRef } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import DesignPreview from '../components/DesignPreview'
import DesignCanvasEditor from '../components/DesignCanvasEditor'
import VideoPreview from '../components/VideoPreview'
import DesignIdeaUpload from '../components/DesignIdeaUpload'
import { toDesignPreview, toVideoPreview } from '../utils/creative'
import { useDraftModule } from '../context/DraftContext'
import SaveDraftButton from '../components/SaveDraftButton'
import BulkDesignUpload from '../components/BulkDesignUpload'

const WORKFLOW_STEPS = [
  'Brand Setup',
  'Topic Discovery',
  'Content Strategy',
  'Content Generation',
  'Creative Generation',
  'Video Generation',
  'Creative Scoring',
  'Approval & Scheduling',
  'Learning Update',
]

const CHANNELS = ['linkedin', 'instagram', 'twitter', 'tiktok', 'facebook']
const BRAND_VOICES = ['professional', 'casual', 'witty', 'bold', 'authoritative', 'friendly']

const mapProfileToOnboarding = (bp = {}, ob = {}) => {
  const competitors = Array.isArray(bp.competitors)
    ? bp.competitors.join(', ')
    : (Array.isArray(ob.competitors) ? ob.competitors.join(', ') : (ob.competitors || ''))
  const palette = bp.colors?.palette || ob.brandColors || []
  return {
    companyName: bp.name || ob.companyName || '',
    website: bp.url || ob.website || '',
    industry: bp.industry || ob.industry || '',
    targetAudience: bp.audience || ob.targetAudience || '',
    brandVoice: bp.voice || ob.brandVoice || 'professional',
    socialChannels: ob.socialChannels?.length ? ob.socialChannels : [],
    brandColors: palette,
    competitors,
    valueProposition: bp.valueProposition || '',
    marketingSummary: bp.marketingSummary || '',
  }
}

const runLabel = (r) => {
  if (r.label) return r.label
  const d = new Date(r.completedAt || r.createdAt)
  return `${r.days}-Day · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const statusBadge = (status) => {
  if (status === 'completed') return 'bg-curi-green/15 text-curi-green'
  if (status === 'running' || status === 'queued') return 'bg-curi-pink/15 text-curi-pink'
  if (status === 'failed') return 'bg-red-500/15 text-red-400'
  return 'bg-theme-subtle/10 text-theme-muted/40'
}

const makePlaceholderRun = (days) => ({
  _id: 'pending',
  status: 'queued',
  progress: 0,
  days,
  steps: WORKFLOW_STEPS.map((name) => ({ name, status: 'pending' })),
})

const sanitizeDesignIdea = (idea) => {
  if (!idea) return null
  return {
    notes: idea.notes || '',
    filename: idea.filename,
    imageUrl: idea.imageUrl,
    analyzedDirection: idea.analyzedDirection,
    uploadedAt: idea.uploadedAt,
  }
}

export default function Autonomous() {
  const { workspaceId, workspace, setWorkspace, fetchMe } = useAuth()
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [channels, setChannels] = useState(['linkedin', 'instagram'])
  const [loading, setLoading] = useState(false)
  const [run, setRun] = useState(null)
  const [historyRuns, setHistoryRuns] = useState([])
  const [entries, setEntries] = useState([])
  const [posts, setPosts] = useState([])
  const [designs, setDesigns] = useState([])
  const [videos, setVideos] = useState([])
  const [topics, setTopics] = useState([])
  const [designIdea, setDesignIdea] = useState(workspace?.brandProfile?.designIdea || null)
  const [editingDesign, setEditingDesign] = useState(null)
  const [userTemplates, setUserTemplates] = useState([])
  const [onboarding, setOnboarding] = useState({
    companyName: '', industry: '', website: '', targetAudience: '',
    brandVoice: 'professional', socialChannels: [], brandColors: [], competitors: '',
    valueProposition: '', marketingSummary: '',
  })
  const [discovering, setDiscovering] = useState(false)
  const [manualAdvancing, setManualAdvancing] = useState(false)
  const pollRef = useRef(null)
  const pollRunIdRef = useRef(null)
  const lastProgressRef = useRef({ progress: -1, at: Date.now() })
  const stuckRetriesRef = useRef(0)
  const progressPanelRef = useRef(null)

  useDraftModule('autonomous', () => ({
    days, channels, designIdea, onboarding,
    runId: run?._id, runStatus: run?.status,
  }), (s) => {
    if (s.days) setDays(s.days)
    if (s.channels) setChannels(s.channels)
    if (s.designIdea) setDesignIdea(s.designIdea)
    if (s.onboarding) setOnboarding(prev => ({ ...prev, ...s.onboarding }))
  })

  const brandReady = workspace?.brandProfile?.name || workspace?.onboarding?.complete || workspace?.brandProfile?.url
  const hasDiscoveryData = Boolean(workspace?.brandProfile?.name || workspace?.brandProfile?.lastDiscoveredAt)

  const applyDiscoveryData = useCallback((bp = workspace?.brandProfile, ob = workspace?.onboarding) => {
    if (!bp?.name && !bp?.url) return toast.error('No discovery data — run Discover from a URL first')
    setOnboarding(mapProfileToOnboarding(bp, ob))
    toast.success('Fields filled from discovery')
  }, [workspace])

  const discoverFromUrl = async () => {
    const url = onboarding.website?.trim() || workspace?.brandProfile?.url
    if (!url) return toast.error('Enter a website URL first')
    if (!workspaceId) return toast.error('Workspace not loaded')
    setDiscovering(true)
    try {
      const { data } = await API.post('/discover', { url, workspaceId }, { timeout: 55000 })
      const bp = data.brandProfile
      setWorkspace((prev) => (prev ? { ...prev, brandProfile: bp } : prev))
      setOnboarding(mapProfileToOnboarding(bp, workspace?.onboarding))
      fetchMe?.()
      toast.success(data.note || 'Brand discovered from URL — review and save')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const fetchHistory = useCallback(async () => {
    if (!workspaceId) return
    try {
      const { data } = await API.get(`/autonomous/history?workspaceId=${workspaceId}`)
      setHistoryRuns(data.runs || [])
      return data.runs || []
    } catch {
      return []
    }
  }, [workspaceId])

  const loadRunResults = useCallback(async (runId) => {
    if (!workspaceId || !runId) return
    try {
      const { data } = await API.get(`/autonomous/run/${runId}`)
      setRun(data.run)
      setPosts(data.posts || [])
      setDesigns((data.designs || []).map(toDesignPreview))
      setVideos((data.videos || []).map(toVideoPreview))
      const cal = await API.get(`/autonomous/calendar?workspaceId=${workspaceId}&runId=${runId}`)
      setEntries(cal.data.entries || [])
    } catch {
      toast.error('Could not load campaign results')
    }
  }, [workspaceId])

  const refreshRunState = useCallback(async (runId) => {
    if (!runId || runId === 'pending') return null
    try {
      const { data } = await API.get(`/autonomous/run/${runId}`, { timeout: 20000 })
      if (data.run) {
        setRun(data.run)
        setPosts(data.posts || [])
        setDesigns((data.designs || []).map(toDesignPreview))
        setVideos((data.videos || []).map(toVideoPreview))
      }
      return data
    } catch {
      return null
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current)
    pollRef.current = null
    pollRunIdRef.current = null
    setLoading(false)
  }, [])

  const applyRunPayload = useCallback((data) => {
    if (data.run) setRun(data.run)
    setPosts(data.posts || [])
    setDesigns((data.designs || []).map(toDesignPreview))
    setVideos((data.videos || []).map(toVideoPreview))
  }, [])

  const advanceStepManually = async () => {
    if (!run?._id || run._id === 'pending') return
    setManualAdvancing(true)
    try {
      const { data } = await API.post(
        `/autonomous/run/${run._id}/advance`,
        { forceUnlock: true },
        { timeout: 55000 },
      )
      applyRunPayload(data)
      const cal = await API.get(`/autonomous/calendar?workspaceId=${workspaceId}&runId=${run._id}`).catch(() => ({ data: { entries: [] } }))
      if (cal.data.entries?.length) setEntries(cal.data.entries)
      if (data.warning) toast(data.warning, { icon: '⏳' })
      if (data.run?.status === 'completed') {
        await fetchHistory()
        toast.success(`${data.run.days}-day campaign saved to history`)
        stopPolling()
      } else if (data.run?.status === 'failed') {
        toast.error(data.run.error || 'Pipeline failed')
        stopPolling()
      } else if (!loading) {
        setLoading(true)
        pollRun(run._id)
      }
    } catch (err) {
      await refreshRunState(run._id)
      toast.error(err.response?.data?.error || err.message || 'Could not advance step')
    } finally {
      setManualAdvancing(false)
    }
  }

  const pollRun = useCallback((runId, { forceUnlock: initialForceUnlock = false } = {}) => {
    if (pollRef.current) clearTimeout(pollRef.current)
    pollRunIdRef.current = runId
    let useForceUnlock = initialForceUnlock
    if (!useForceUnlock) {
      lastProgressRef.current = { progress: -1, at: Date.now() }
      stuckRetriesRef.current = 0
    }

    const tick = async () => {
      if (pollRunIdRef.current !== runId) return
      try {
        const { data } = await API.post(
          `/autonomous/run/${runId}/advance`,
          { forceUnlock: useForceUnlock },
          { timeout: 55000 },
        )
        useForceUnlock = false
        stuckRetriesRef.current = 0
        setRun(data.run)
        setPosts(data.posts || [])
        setDesigns((data.designs || []).map(toDesignPreview))
        setVideos((data.videos || []).map(toVideoPreview))

        const progress = data.run?.progress ?? 0
        if (progress !== lastProgressRef.current.progress) {
          lastProgressRef.current = { progress, at: Date.now() }
        } else if (Date.now() - lastProgressRef.current.at > 20000 && stuckRetriesRef.current < 3) {
          stuckRetriesRef.current += 1
          lastProgressRef.current.at = Date.now()
          toast('Pipeline may be stuck — retrying with unlock…', { icon: '⏳' })
          pollRef.current = setTimeout(() => pollRun(runId, { forceUnlock: true }), 500)
          return
        }

        if (data.run?.status === 'completed') {
          const cal = await API.get(`/autonomous/calendar?workspaceId=${workspaceId}&runId=${runId}`)
          setEntries(cal.data.entries || [])
          await fetchHistory()
          toast.success(`${data.run.days}-day campaign saved to history`)
          stopPolling()
          return
        }
        if (data.run?.status === 'failed') {
          await fetchHistory()
          toast.error(data.run.error || data.error || 'Pipeline failed')
          stopPolling()
          return
        }

        const cal = await API.get(`/autonomous/calendar?workspaceId=${workspaceId}&runId=${runId}`).catch(() => ({ data: { entries: [] } }))
        if (cal.data.entries?.length) setEntries(cal.data.entries)

        pollRef.current = setTimeout(tick, 800)
      } catch (err) {
        const isTimeout = err.code === 'ECONNABORTED' || err.response?.status === 504
        if (err.response?.data?.run) {
          setRun(err.response.data.run)
          setPosts(err.response.data.posts || [])
          setDesigns((err.response.data.designs || []).map(toDesignPreview))
          setVideos((err.response.data.videos || []).map(toVideoPreview))
          if (err.response.data.run.status === 'failed') {
            toast.error(err.response.data.run.error || err.response?.data?.error || 'Pipeline failed')
            stopPolling()
            return
          }
        } else {
          await refreshRunState(runId)
        }
        if (isTimeout && stuckRetriesRef.current < 5) {
          stuckRetriesRef.current += 1
          pollRef.current = setTimeout(() => pollRun(runId, { forceUnlock: true }), 3000)
          return
        }
        pollRef.current = setTimeout(tick, 1500)
      }
    }

    tick()
  }, [workspaceId, fetchHistory, stopPolling, refreshRunState])

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current)
  }, [])

  useEffect(() => {
    if (run?._id !== 'pending' || !loading) return undefined
    const watchdog = setTimeout(async () => {
      try {
        const runs = await fetchHistory()
        const active = runs?.find((x) => x.status === 'running' || x.status === 'queued')
        if (active) {
          setRun(active)
          toast('Campaign found — resuming pipeline…', { icon: '⏳' })
          pollRun(active._id)
          return
        }
      } catch { /* ignore */ }
      toast.error('Engine failed to start — check credits and try again')
      setLoading(false)
      setRun(null)
    }, 35000)
    return () => clearTimeout(watchdog)
  }, [run?._id, loading, fetchHistory, pollRun])

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/autonomous/topics?workspaceId=${workspaceId}`).then(r => setTopics(r.data.topics || [])).catch(() => {})
    API.get(`/design/templates?workspaceId=${workspaceId}`).then(r => setUserTemplates(r.data.templates || [])).catch(() => {})
    fetchHistory().then(runs => {
      const active = runs.find(x => x.status === 'running' || x.status === 'queued')
      if (active) {
        setRun(active)
        setLoading(true)
        pollRun(active._id)
        return
      }
      const last = runs.find(x => x.status === 'completed')
      if (last) loadRunResults(last._id)
    })
    API.get('/workspace').then(r => {
      const ob = r.data.onboarding
      const bp = r.data.brandProfile
      if (ob || bp) {
        setOnboarding(mapProfileToOnboarding(bp, ob))
      }
      if (bp) {
        setWorkspace(prev => prev ? { ...prev, brandProfile: bp, onboarding: ob } : prev)
        if (bp.designIdea) setDesignIdea(bp.designIdea)
      }
    }).catch(() => {})
  }, [workspaceId, pollRun, fetchHistory, loadRunResults])

  const saveOnboarding = async () => {
    if (!workspaceId) return toast.error('Workspace not loaded — sign out and sign in again')
    try {
      const competitors = Array.isArray(onboarding.competitors)
        ? onboarding.competitors
        : String(onboarding.competitors || '').split(',').map(s => s.trim()).filter(Boolean)
      const { data } = await API.post('/workspace/onboarding', {
        ...onboarding,
        competitors,
        workspaceId,
        socialChannels: channels.length ? channels : onboarding.socialChannels,
      }, { timeout: 30000 })
      setWorkspace(data.workspace)
      fetchMe?.()
      toast.success('Brand profile saved')
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Save failed')
    }
  }

  const generate = async () => {
    if (!workspaceId) return toast.error('Workspace not loaded — sign out and sign in again')
    if (!brandReady && !onboarding.companyName) {
      return toast.error('Complete brand setup first')
    }
    setLoading(true)
    setRun(makePlaceholderRun(days))
    setEntries([])
    setPosts([])
    setDesigns([])
    setVideos([])
    requestAnimationFrame(() => {
      progressPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    try {
      if (onboarding.companyName && !workspace?.onboarding?.complete) {
        const competitors = Array.isArray(onboarding.competitors)
          ? onboarding.competitors
          : String(onboarding.competitors || '').split(',').map(s => s.trim()).filter(Boolean)
        await API.post('/workspace/onboarding', {
          ...onboarding,
          competitors,
          workspaceId,
          socialChannels: channels,
        }, { timeout: 15000 }).catch(() => {})
      }
      const { data } = await API.post('/autonomous/generate', {
        workspaceId,
        days,
        channels,
        designIdea: sanitizeDesignIdea(designIdea),
      }, { timeout: 45000 })
      if (!data?.run?._id) throw new Error('No run returned from server')
      setRun(data.run)
      toast.success('Autonomous engine started')
      fetchMe?.()
      pollRun(data.run._id)
    } catch (err) {
      const isTimeout = !err.response || err.code === 'ECONNABORTED' || err.response?.status === 504
      if (isTimeout) {
        const runs = await fetchHistory()
        const active = runs?.find(x => x.status === 'running' || x.status === 'queued')
        if (active) {
          setRun(active)
          toast('Request timed out but campaign started — resuming…', { icon: '⏳' })
          fetchMe?.()
          pollRun(active._id)
          return
        }
      }
      toast.error(err.response?.data?.details?.join(', ') || err.response?.data?.error || err.message || 'Failed to start')
      setLoading(false)
      setRun(null)
    }
  }

  const toggleChannel = (ch) => {
    setChannels(prev => prev.includes(ch) ? (prev.length > 1 ? prev.filter(c => c !== ch) : prev) : [...prev, ch])
  }

  return (
    <PageShell>
      <PageHeader
        title="Curi Autonomous Content Engine"
        description="Connect your brand, click one button, and Curi finds trends, builds strategy, writes content, creates designs and videos, scores creatives, and schedules your next campaign."
        action={<SaveDraftButton />}
      />

      <div className="page-card mb-6 overflow-x-auto">
        <div className="section-label mb-4">Autonomous Workflow</div>
        <div className="flex items-center gap-1 min-w-max">
          {WORKFLOW_STEPS.map((step, i) => {
            const runStep = run?.steps?.find(s => s.name === step)
            const status = runStep?.status
            return (
              <div key={step} className="flex items-center">
                <div className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  status === 'completed' ? 'bg-curi-green/15 text-curi-green'
                  : status === 'running' ? 'bg-curi-pink/15 text-curi-pink animate-pulse'
                  : status === 'failed' ? 'bg-red-500/15 text-red-400'
                  : 'bg-theme-subtle/5 text-theme-muted/40'
                }`}>
                  {step}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`w-4 h-0.5 mx-0.5 ${status === 'completed' ? 'bg-curi-green/40' : 'bg-theme-border'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <div className="page-card">
            <div className="flex items-center justify-between mb-3">
              <div className="section-label">Brand Setup</div>
              {brandReady && <span className="badge bg-curi-green/15 text-curi-green">Ready</span>}
            </div>
            <div className="space-y-3">
              {hasDiscoveryData && (
                <div className="rounded-xl border border-curi-green/30 bg-curi-green/5 p-3 space-y-2">
                  <p className="text-[10px] text-theme-muted/60 leading-snug">
                    Discovery data available for <span className="font-bold text-theme-text">{workspace?.brandProfile?.name}</span>
                    {workspace?.brandProfile?.lastDiscoveredAt && (
                      <span className="block text-theme-muted/45 mt-0.5">
                        Last discovered {new Date(workspace.brandProfile.lastDiscoveredAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyDiscoveryData()}
                      className="btn-secondary text-[10px] py-1.5 px-2"
                    >
                      Use discovery data
                    </button>
                    <button
                      type="button"
                      onClick={discoverFromUrl}
                      disabled={discovering}
                      className="btn-secondary text-[10px] py-1.5 px-2"
                    >
                      {discovering ? 'Discovering…' : 'Re-discover from URL'}
                    </button>
                  </div>
                </div>
              )}
              <input className="input text-sm" placeholder="Company name" value={onboarding.companyName}
                onChange={e => setOnboarding(p => ({ ...p, companyName: e.target.value }))} />
              <input className="input text-sm" placeholder="Website (https://…)" value={onboarding.website}
                onChange={e => setOnboarding(p => ({ ...p, website: e.target.value }))} />
              <input className="input text-sm" placeholder="Industry" value={onboarding.industry}
                onChange={e => setOnboarding(p => ({ ...p, industry: e.target.value }))} />
              <input className="input text-sm" placeholder="Target audience" value={onboarding.targetAudience}
                onChange={e => setOnboarding(p => ({ ...p, targetAudience: e.target.value }))} />
              <select
                className="input text-sm"
                value={onboarding.brandVoice}
                onChange={e => setOnboarding(p => ({ ...p, brandVoice: e.target.value }))}
              >
                {BRAND_VOICES.map((v) => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)} voice</option>
                ))}
              </select>
              <input className="input text-sm" placeholder="Competitors (comma-separated)" value={onboarding.competitors}
                onChange={e => setOnboarding(p => ({ ...p, competitors: e.target.value }))} />
              {onboarding.valueProposition && (
                <p className="text-[10px] text-theme-muted/55 leading-snug border border-theme-border rounded-lg p-2 bg-theme-subtle/5">
                  <span className="font-bold text-theme-muted/70">Value prop: </span>
                  {onboarding.valueProposition}
                </p>
              )}
              <button onClick={saveOnboarding} className="btn-secondary w-full text-sm">Save Brand Profile</button>
              {!hasDiscoveryData && (
                <button
                  type="button"
                  onClick={discoverFromUrl}
                  disabled={discovering || !onboarding.website?.trim()}
                  className="btn-primary w-full text-sm"
                >
                  {discovering ? 'Discovering from URL…' : 'Discover brand from URL'}
                </button>
              )}
              <button onClick={() => navigate('/discover')} className="text-xs text-curi-blue font-bold hover:underline w-full text-center">
                Open full Discover page
              </button>
            </div>
          </div>

          <div className="page-card">
            <div className="section-label mb-3">Channels</div>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(ch => (
                <button key={ch} onClick={() => toggleChannel(ch)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${channels.includes(ch) ? 'bg-curi-pink/15 text-curi-pink' : 'bg-theme-subtle/5 text-theme-muted/50'}`}>
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="page-card">
            <DesignIdeaUpload
              workspaceId={workspaceId}
              value={designIdea}
              onChange={setDesignIdea}
              compact
            />
          </div>

          <div className="page-card">
            <div className="section-label mb-3">Campaign Length</div>
            <div className="flex gap-2">
              {[30, 60, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold ${days === d ? 'bg-curi-blue text-white' : 'bg-theme-subtle/5 text-theme-muted/50'}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

      </div>

      {historyRuns.length > 0 && (
        <div className="page-card mb-6">
          <div className="section-label mb-3">Campaign History</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
            {historyRuns.map(h => (
              <button
                key={h._id}
                type="button"
                onClick={() => loadRunResults(h._id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  run?._id === h._id
                    ? 'border-curi-pink/40 bg-curi-pink/5'
                    : 'border-theme-border hover:border-theme-border/80 bg-theme-subtle/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-base font-bold text-theme-text truncate">{runLabel(h)}</span>
                  <span className={`badge text-xs capitalize flex-shrink-0 ${statusBadge(h.status)}`}>{h.status}</span>
                </div>
                {h.stats && (
                  <div className="text-sm text-theme-muted/50 font-medium">
                    {h.stats.contentGenerated || 0} posts · {h.stats.designsGenerated || 0} designs · {h.stats.videosGenerated || 0} videos
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
          <div className="page-card bg-gradient-to-br from-curi-pink/10 to-curi-blue/10 border-curi-pink/20">
            <h2 className="text-2xl font-extrabold text-theme-text mb-2">Generate Next {days} Days</h2>
            <p className="text-theme-muted/60 text-base mb-5">
              Curi builds a custom {days}-day content plan tailored to your brand — phased themes, channel strategy, and calendar items — then writes posts, creates designs and videos, and schedules publishing.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-theme-muted/50 font-medium">100 credits</span>
              <div className="flex items-center gap-3">
                {loading && (
                  <button type="button" onClick={stopPolling} className="btn-secondary text-sm px-4 py-2">
                    Cancel
                  </button>
                )}
                <button onClick={generate} disabled={loading} className="btn-primary text-base px-10 py-3">
                  {loading ? 'Engine Running...' : `Generate Next ${days} Days`}
                </button>
              </div>
            </div>
          </div>

          {(run && run._id !== 'pending' || entries.length > 0) && (
            <BulkDesignUpload
              workspaceId={workspaceId}
              runId={run?._id !== 'pending' ? run?._id : undefined}
              entries={entries}
              onComplete={() => {
                if (run?._id) loadRunResults(run._id)
              }}
            />
          )}

          <AnimatePresence>
            {(loading || run) && (
              <motion.div
                ref={progressPanelRef}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="page-card"
              >
                {run?._id === 'pending' ? (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-theme-text capitalize">queued — starting…</span>
                      <span className="badge bg-curi-blue/15 text-curi-blue">{days}-Day Campaign</span>
                    </div>
                    <div className="h-2 bg-theme-subtle/10 rounded-full overflow-hidden mb-4">
                      <div className="h-full bg-curi-gradient rounded-full animate-pulse w-1/4" />
                    </div>
                    <p className="text-sm text-theme-muted/60">
                      Connecting to the autonomous engine and reserving credits…
                    </p>
                  </>
                ) : run ? (
                  <>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-theme-text capitalize">{run.status} — {run.progress ?? 0}%</span>
                  <span className="badge bg-curi-blue/15 text-curi-blue">{runLabel(run)}</span>
                </div>
                <div className="h-2 bg-theme-subtle/10 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-curi-gradient rounded-full transition-all duration-500" style={{ width: `${run.progress}%` }} />
                </div>
                {run.status === 'running' && run.steps?.find(s => s.status === 'running') && (
                  <p className="text-sm text-theme-muted/60 mb-3">
                    {run.steps.find(s => s.status === 'running').name}
                    {run.steps.find(s => s.status === 'running').summary
                      ? ` — ${run.steps.find(s => s.status === 'running').summary}`
                      : ''}
                  </p>
                )}
                {run.steps?.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    <div className="section-label">Pipeline steps</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {WORKFLOW_STEPS.map((step) => {
                        const s = run.steps.find((x) => x.name === step)
                        const st = s?.status || 'pending'
                        return (
                          <div
                            key={step}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
                              st === 'completed' ? 'bg-curi-green/10 text-curi-green'
                              : st === 'running' ? 'bg-curi-pink/10 text-curi-pink'
                              : st === 'failed' ? 'bg-red-500/10 text-red-400'
                              : 'bg-theme-subtle/5 text-theme-muted/45'
                            }`}
                          >
                            <span className="font-bold truncate">{step}</span>
                            <span className="capitalize flex-shrink-0">{st}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {entries.length > 0 && (
                  <p className="text-sm text-curi-blue font-semibold mb-3">
                    {entries.length} calendar entries in your {run.days}-day plan
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {run.status !== 'completed' && run.status !== 'failed' && run._id !== 'pending' && (
                    <button
                      type="button"
                      onClick={advanceStepManually}
                      disabled={manualAdvancing}
                      className="btn-primary text-sm px-5 py-2"
                    >
                      {manualAdvancing ? 'Advancing…' : 'Next Step →'}
                    </button>
                  )}
                </div>
                {run.strategy?.planBrief && (
                  <div className="mb-4 p-4 rounded-xl bg-theme-subtle/5 border border-theme-border space-y-3">
                    <div className="section-label">Custom content plan</div>
                    {run.strategy.name && (
                      <p className="text-sm font-bold text-theme-text">{run.strategy.name}</p>
                    )}
                    {run.strategy.planBrief.campaignGoal && (
                      <p className="text-sm text-theme-muted/70">
                        <span className="font-semibold text-theme-text">Goal: </span>
                        {run.strategy.planBrief.campaignGoal}
                      </p>
                    )}
                    {run.strategy.planBrief.narrative && (
                      <p className="text-sm text-theme-muted/60 leading-relaxed">{run.strategy.planBrief.narrative}</p>
                    )}
                    {run.strategy.planBrief.contentPillars?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider mb-1.5">Content pillars</p>
                        <div className="flex flex-wrap gap-1.5">
                          {run.strategy.planBrief.contentPillars.map((p) => (
                            <span key={p} className="badge bg-curi-pink/10 text-curi-pink text-[10px]">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {run.strategy.planBrief.phases?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">Phases</p>
                        {run.strategy.planBrief.phases.map((phase) => (
                          <div key={phase.name} className="text-xs text-theme-muted/60">
                            <span className="font-bold text-theme-text">{phase.name}</span>
                            {phase.dayRange && <span className="text-theme-muted/40"> ({phase.dayRange})</span>}
                            {phase.focus && <span> — {phase.focus}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {run.strategy.planBrief.channelStrategy && (
                      <p className="text-xs text-theme-muted/55 leading-relaxed">
                        <span className="font-semibold text-theme-text">Channel approach: </span>
                        {run.strategy.planBrief.channelStrategy}
                      </p>
                    )}
                  </div>
                )}
                {run.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-center">
                    {[
                      { l: 'Topics', v: run.stats.topicsFound },
                      { l: 'Content', v: run.stats.contentGenerated },
                      { l: 'Designs', v: run.stats.designsGenerated },
                      { l: 'Videos', v: run.stats.videosGenerated },
                      { l: 'Approved', v: run.stats.approved },
                      { l: 'Scheduled', v: run.stats.scheduled },
                    ].map(s => (
                      <div key={s.l} className="bg-theme-subtle/5 rounded-xl py-2">
                        <div className="text-lg font-black text-curi-pink">{s.v}</div>
                        <div className="text-[10px] text-theme-muted/40 font-medium">{s.l}</div>
                      </div>
                    ))}
                  </div>
                )}
                {run.status === 'completed' && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => navigate('/approvals')} className="btn-secondary text-sm">Review Approvals</button>
                    <button onClick={() => navigate('/design')} className="btn-secondary text-sm">Open Design Library</button>
                    <button onClick={() => navigate('/calendar')} className="btn-secondary text-sm">View Calendar</button>
                  </div>
                )}
                  </>
                ) : (
                  <p className="text-sm text-theme-muted/60">Preparing campaign…</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {(designs.length > 0 || videos.length > 0 || posts.length > 0) && (
            <div className="space-y-5">
              {posts.length > 0 && (
                <div className="page-card">
                  <div className="section-label mb-4">
                    Generated Posts ({posts.length})
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {posts.map(p => (
                      <div key={p._id} className="p-4 rounded-xl bg-theme-subtle/5 border border-theme-border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="badge bg-curi-blue/15 text-curi-blue capitalize text-[10px]">{p.platform}</span>
                          <span className={`badge text-[10px] capitalize ${p.status === 'scheduled' ? 'bg-curi-green/15 text-curi-green' : 'bg-theme-subtle/10 text-theme-muted/40'}`}>{p.status}</span>
                        </div>
                        <div className="text-sm font-bold text-theme-text mb-1">{p.title}</div>
                        <p className="text-sm text-theme-muted/60 whitespace-pre-wrap line-clamp-4">{p.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {designs.length > 0 && (
                <div className="page-card">
                  <div className="section-label mb-4">
                    Generated Designs ({designs.length})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {designs.map(d => (
                      <DesignPreview key={d._id} design={d} onEdit={setEditingDesign} />
                    ))}
                  </div>
                </div>
              )}
              {videos.length > 0 && (
                <div className="page-card">
                  <div className="section-label mb-4">
                    Generated Videos ({videos.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {videos.map(v => (
                      <VideoPreview key={v._id} video={v} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {topics.length > 0 && !run && !loading && (
            <div className="page-card">
              <div className="section-label mb-3">Discovered Topics</div>
              <div className="flex flex-wrap gap-2">
                {topics.slice(0, 12).map(t => (
                  <span key={t._id} className="badge bg-theme-subtle/10 text-theme-muted/60">
                    {t.topic} <span className="text-curi-pink ml-1">{t.relevance}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className="page-card">
              <div className="section-label mb-3">Generated Calendar Preview</div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {entries.slice(0, 15).map(e => (
                  <div key={e._id} className="flex gap-3 items-center py-2 border-b border-theme-border last:border-0">
                    <span className="w-8 h-8 rounded-lg bg-curi-gradient text-white text-xs font-black flex items-center justify-center flex-shrink-0">{e.day}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-theme-text truncate">{e.topic}</div>
                      {e.caption && e.caption !== e.topic && (
                        <div className="text-[10px] text-theme-muted/45 truncate">{e.caption}</div>
                      )}
                      <div className="text-xs text-theme-muted/40 capitalize">{e.platform} · {e.type} · {e.publishTime}</div>
                    </div>
                    <span className={`badge text-[10px] ${e.status === 'scheduled' ? 'bg-curi-green/15 text-curi-green' : 'bg-theme-subtle/10 text-theme-muted/40'}`}>{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {editingDesign && (
        <DesignCanvasEditor
          design={editingDesign}
          workspaceId={workspaceId}
          userTemplates={userTemplates}
          onClose={() => setEditingDesign(null)}
          onSaved={(updated) => {
            setDesigns(prev => prev.map(d => d._id === updated._id ? { ...d, ...updated } : d))
            setEditingDesign(null)
          }}
        />
      )}
    </PageShell>
  )
}
