import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import LaunchCalendar from '../components/launch/LaunchCalendar'
import LaunchActivity from '../components/launch/LaunchActivity'
import DesignPreview from '../components/DesignPreview'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, FileText, LayoutTemplate, Rocket, Calendar, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const PLATFORM_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

const defaultScheduleAt = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const minScheduleAt = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Launch() {
  const { workspaceId, fetchMe } = useAuth()
  const navigate = useNavigate()
  const { workflow } = useCoreWorkflow()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [workflowDesigns, setWorkflowDesigns] = useState([])
  const [overview, setOverview] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [scheduleMode, setScheduleMode] = useState('immediate')
  const [scheduleStartAt, setScheduleStartAt] = useState(defaultScheduleAt)
  const [integrationStatus, setIntegrationStatus] = useState(null)
  const [progressMessage, setProgressMessage] = useState('')
  const pollRef = useRef(null)
  const pollingIdRef = useRef(null)

  const goal = useMemo(() => {
    if (workflow.contentText) return workflow.contentText.slice(0, 200)
    if (workflow.topic) return `Launch: ${workflow.topic}`
    return 'Launch campaign from Curi Create & Design'
  }, [workflow.contentText, workflow.topic])

  const workflowDesignIds = useMemo(() => {
    const ids = [...(workflow.designIds || [])]
    if (workflow.designId) ids.push(workflow.designId)
    return [...new Set(ids.map(String))]
  }, [workflow.designIds, workflow.designId])

  useDraftModule('launch', () => ({
    campaignId: campaign?._id, campaign, selectedPlatforms, scheduleMode, scheduleStartAt,
  }), (s) => {
    if (s.campaign) setCampaign(s.campaign)
    if (s.selectedPlatforms?.length) setSelectedPlatforms(s.selectedPlatforms)
    if (s.scheduleMode) setScheduleMode(s.scheduleMode)
    if (s.scheduleStartAt) setScheduleStartAt(s.scheduleStartAt)
  })

  const loadOverview = useCallback(async () => {
    if (!workspaceId) {
      setOverview(null)
      setLoadingOverview(false)
      return
    }
    setLoadingOverview(true)
    try {
      const { data } = await API.get(`/launch/overview?workspaceId=${workspaceId}`)
      setOverview(data)
    } catch {
      setOverview(null)
    } finally {
      setLoadingOverview(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    const load = async () => {
      try {
        const [accountsRes, designsRes] = await Promise.all([
          API.get('/publish/accounts'),
          API.get(`/design/library?workspaceId=${workspaceId}`),
        ])
        const accts = accountsRes.data.accounts || []
        setAccounts(accts)
        const connected = accts.filter((a) => a.connected).map((a) => a.platform)
        setSelectedPlatforms((prev) => (prev.length ? prev : connected))

        const allDesigns = designsRes.data.designs || []
        const ids = new Set(workflowDesignIds)
        setWorkflowDesigns(
          ids.size
            ? allDesigns.filter((d) => ids.has(String(d._id)))
            : [],
        )
      } catch {
        setSelectedPlatforms([])
      }
    }
    load()
    loadOverview()
  }, [workspaceId, workflowDesignIds, loadOverview])

  const pollCampaign = useCallback(async (id) => {
    try {
      const { data } = await API.post(`/launch/campaign/${id}/advance`)
      setCampaign(data.campaign)
      if (data.integrationStatus) setIntegrationStatus(data.integrationStatus)
      if (data.progressMessage) setProgressMessage(data.progressMessage)
      if (data.campaign.status === 'generating') {
        pollRef.current = setTimeout(() => pollCampaign(id), 1500)
      } else {
        pollingIdRef.current = null
        if (data.campaign.status === 'draft' && data.campaign.error) {
          toast.error(data.campaign.error)
        } else if (data.campaign.status === 'draft' || data.campaign.status === 'review' || data.campaign.status === 'active') {
          const count = data.campaign.content?.length || 0
          if (count) {
            if (data.campaign.scheduleMode === 'scheduled') {
              const when = data.campaign.scheduledLaunchAt || data.campaign.startDate
              toast.success(
                when
                  ? `Campaign scheduled — ${count} posts starting ${format(parseISO(when), 'MMM d, yyyy h:mm a')}`
                  : `Campaign scheduled — ${count} posts on your calendar`,
              )
            } else {
              toast.success(`Campaign ready — ${count} posts queued`)
            }
          } else toast.error('Campaign finished but no posts were generated')
          fetchMe?.()
          loadOverview()
        }
        setIsSubmitting(false)
      }
    } catch (err) {
      pollingIdRef.current = null
      toast.error(err.response?.data?.error || 'Could not load campaign status')
      setIsSubmitting(false)
    }
  }, [fetchMe, loadOverview])

  useEffect(() => {
    if (!campaign?._id || campaign.status !== 'generating') return
    if (pollingIdRef.current === campaign._id) return
    pollingIdRef.current = campaign._id
    pollCampaign(campaign._id)
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [campaign?._id, campaign?.status, pollCampaign])

  const togglePlatform = (platform) => {
    setSelectedPlatforms((prev) => (
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    ))
  }

  const connectedSet = useMemo(() => new Set(accounts.filter((a) => a.connected).map((a) => a.platform)), [accounts])

  const launch = async () => {
    if (!workflow.contentId && !workflowDesignIds.length) {
      return toast.error('Complete Curi Create and Curi Design first')
    }
    if (!selectedPlatforms.length) {
      return toast.error('Connect at least one channel in Social Channels')
    }

    const unconnected = selectedPlatforms.filter((p) => !connectedSet.has(p))
    if (unconnected.length) {
      return toast.error(`Connect ${unconnected.join(', ')} in Social Channels before launching`)
    }

    if (scheduleMode === 'scheduled') {
      const when = new Date(scheduleStartAt)
      if (Number.isNaN(when.getTime()) || when <= new Date()) {
        return toast.error('Pick a future date and time to schedule')
      }
    }

    setIsSubmitting(true)
    setProgressMessage('Starting launch…')
    try {
      const { data } = await API.post('/launch/campaign', {
        workspaceId,
        goal,
        timeline: 30,
        platforms: selectedPlatforms,
        sourceContentId: workflow.contentId || undefined,
        designIds: workflowDesigns.length
          ? workflowDesigns.map((d) => d._id)
          : workflowDesignIds,
        topic: workflow.topic || undefined,
        scheduleMode,
        scheduleStartAt: scheduleMode === 'scheduled' ? new Date(scheduleStartAt).toISOString() : undefined,
      })
      pollingIdRef.current = null
      setCampaign(data.campaign)
      if (data.integrationStatus) setIntegrationStatus(data.integrationStatus)
      if (data.progressMessage) setProgressMessage(data.progressMessage)
      toast.success(scheduleMode === 'scheduled' ? 'Scheduling campaign…' : 'Launch started!')
      fetchMe?.()
    } catch (err) {
      const data = err.response?.data
      if (data?.needsIntegrations) {
        toast.error(data.error || 'Connect social channels before launching')
        setIntegrationStatus({ ready: false, missing: data.missingPlatforms || [] })
      } else {
        toast.error(data?.error || 'Launch failed')
      }
      setIsSubmitting(false)
    }
  }

  const sendToApprovals = async () => {
    if (!campaign?._id) return
    try {
      const { data } = await API.post(`/launch/campaign/${campaign._id}/submit-for-approval`)
      setCampaign(data.campaign)
      toast.success(data.message || 'Sent to approval queue')
      navigate('/approvals')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send to approvals')
    }
  }

  const scheduleCampaign = async () => {
    if (!campaign?._id) return
    const when = campaign.scheduledLaunchAt || campaign.startDate || scheduleStartAt
    try {
      const { data } = await API.post(`/launch/campaign/${campaign._id}/schedule`, {
        workspaceId,
        scheduleStartAt: when ? new Date(when).toISOString() : new Date(scheduleStartAt).toISOString(),
      })
      setCampaign(data.campaign)
      toast.success(data.message || 'Posts scheduled')
      loadOverview()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not schedule campaign')
    }
  }

  const formatScheduleDate = (value) => {
    if (!value) return null
    try {
      return format(parseISO(value), 'EEEE, MMM d, yyyy · h:mm a')
    } catch {
      return null
    }
  }

  const progress = campaign?.status === 'generating'
    ? Math.min(95, 15 + (campaign.content?.length || 0) * 8)
    : (campaign?.status === 'draft' || campaign?.status === 'review') ? 100 : 5

  const connectedChannelsLabel = useMemo(() => {
    const connected = integrationStatus?.connected?.length
      ? integrationStatus.connected
      : selectedPlatforms.filter((p) => connectedSet.has(p))
    return connected.map((id) => PLATFORM_OPTIONS.find((p) => p.id === id)?.label || id).join(', ')
  }, [integrationStatus?.connected, selectedPlatforms, connectedSet])

  const missingIntegrations = integrationStatus?.missing?.length
    ? integrationStatus.missing
    : []

  const formatPlatform = (id) => PLATFORM_OPTIONS.find((p) => p.id === id)?.label || id

  const statusLine = useMemo(() => {
    if (campaign?.status !== 'generating') return null
    if (progressMessage) return progressMessage
    const count = campaign?.content?.length || 0
    return count
      ? `${count} post${count === 1 ? '' : 's'} generated so far…`
      : 'Setting up your campaign…'
  }, [campaign?.status, campaign?.content?.length, progressMessage])

  const hasCreateSource = Boolean(workflow.contentId && workflow.contentText)
  const hasDesignSource = workflowDesigns.length > 0

  return (
    <PageShell>
      <CoreWorkflowNav stepId="launch" hideNext />

      <PageHeader
        title="Curi Launch"
        description="Review content from Create and Design, pick channels, and launch your campaign."
      />

      <div className="space-y-6">
        <div className="page-card border border-curi-green/20 bg-curi-green/5">
          <div className="section-label mb-3">Ingested from your workflow</div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-theme-text text-sm mb-2">
                <FileText size={14} className="text-curi-green" />
                Curi Create
              </div>
              {hasCreateSource ? (
                <div className="rounded-xl bg-theme-bg/50 border border-theme-subtle/10 p-4">
                  {workflow.topic && (
                    <div className="text-xs text-theme-muted/50 mb-1">Topic: {workflow.topic}</div>
                  )}
                  <p className="text-sm text-theme-text whitespace-pre-wrap">{workflow.contentText}</p>
                  {workflow.createPlatform && (
                    <span className="badge bg-curi-green/15 text-curi-green text-xs mt-2 capitalize">
                      {workflow.createPlatform}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-theme-muted/50">
                  No saved content yet.{' '}
                  <button type="button" onClick={() => navigate('/create')} className="text-curi-pink hover:underline font-semibold">
                    Go to Curi Create
                  </button>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 font-semibold text-theme-text text-sm mb-2">
                <LayoutTemplate size={14} className="text-curi-blue" />
                Curi Design
              </div>
              {hasDesignSource ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {workflowDesigns.map((design) => (
                    <DesignPreview key={design._id} design={design} compact />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-theme-muted/50">
                  No designs from your workflow yet.{' '}
                  <button type="button" onClick={() => navigate('/design/studio')} className="text-curi-pink hover:underline font-semibold">
                    Go to Curi Design
                  </button>{' '}
                  and use Proceed to Launch.
                </p>
              )}
            </div>
          </div>
        </div>

        {!campaign ? (
          <>
            <div className="page-card">
              <div className="section-label mb-3">Launch channels</div>
              {connectedSet.size === 0 ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 mb-4 text-sm text-theme-text">
                  Connect platforms in{' '}
                  <button type="button" onClick={() => navigate('/channels')} className="text-curi-pink hover:underline font-semibold">
                    Social Channels
                  </button>{' '}
                  before launching.
                </div>
              ) : (
                <p className="text-sm text-theme-muted/50 mb-4">
                  Select where this campaign will publish.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {PLATFORM_OPTIONS.map((platform) => {
                  const connected = connectedSet.has(platform.id)
                  const selected = selectedPlatforms.includes(platform.id)
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-curi-pink/40 bg-curi-pink/10'
                          : 'border-theme-subtle/10 bg-theme-subtle/5 hover:border-theme-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-theme-text text-sm">{platform.label}</span>
                        {connected ? (
                          <CheckCircle2 size={16} className="text-curi-green shrink-0" />
                        ) : (
                          <AlertCircle size={16} className="text-amber-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="section-label mb-3 mt-6">When to publish</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setScheduleMode('immediate')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    scheduleMode === 'immediate'
                      ? 'border-curi-pink/40 bg-curi-pink/10'
                      : 'border-theme-subtle/10 bg-theme-subtle/5 hover:border-theme-border'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-theme-text text-sm">
                    <Rocket size={16} className="text-curi-pink shrink-0" />
                    Launch now
                  </div>
                  <p className="text-xs text-theme-muted/50 mt-1">Generate posts and send to approvals</p>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('scheduled')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    scheduleMode === 'scheduled'
                      ? 'border-curi-blue/40 bg-curi-blue/10'
                      : 'border-theme-subtle/10 bg-theme-subtle/5 hover:border-theme-border'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-theme-text text-sm">
                    <Calendar size={16} className="text-curi-blue shrink-0" />
                    Schedule for later
                  </div>
                  <p className="text-xs text-theme-muted/50 mt-1">Pick a start date — posts appear in Scheduled</p>
                </button>
              </div>

              {scheduleMode === 'scheduled' && (
                <div className="mb-6 rounded-xl border border-curi-blue/20 bg-curi-blue/5 p-4">
                  <label htmlFor="schedule-start" className="flex items-center gap-2 text-sm font-semibold text-theme-text mb-2">
                    <Clock size={14} className="text-curi-blue" />
                    Start date & time
                  </label>
                  <input
                    id="schedule-start"
                    type="datetime-local"
                    value={scheduleStartAt}
                    min={minScheduleAt()}
                    onChange={(e) => setScheduleStartAt(e.target.value)}
                    className="w-full rounded-lg border border-theme-subtle/20 bg-theme-bg px-3 py-2 text-sm text-theme-text"
                  />
                  {formatScheduleDate(scheduleStartAt) && (
                    <p className="text-xs text-theme-muted/60 mt-2">
                      Posts will publish starting {formatScheduleDate(scheduleStartAt)}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={launch}
                disabled={isSubmitting || (!hasCreateSource && !hasDesignSource)}
                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
              >
                {scheduleMode === 'scheduled' ? <Calendar size={18} /> : <Rocket size={18} />}
                {isSubmitting
                  ? (scheduleMode === 'scheduled' ? 'Scheduling…' : 'Launching…')
                  : (scheduleMode === 'scheduled' ? 'Schedule Campaign — 50 Credits' : 'Launch Campaign — 50 Credits')}
              </button>
            </div>

            <LaunchActivity overview={overview} loading={loadingOverview} />
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className={`page-card border ${campaign.status === 'review' || campaign.status === 'draft' ? 'bg-gradient-to-r from-curi-green/10 to-curi-blue/10 border-curi-green/20' : campaign.scheduleMode === 'scheduled' ? 'bg-gradient-to-r from-curi-blue/10 to-curi-green/10 border-curi-blue/20' : 'bg-gradient-to-r from-curi-pink/10 to-curi-blue/10 border-curi-pink/20'}`}>
              <div className="font-bold text-theme-text text-lg">
                {campaign.status === 'generating'
                  ? (campaign.scheduleMode === 'scheduled' ? 'Scheduling in progress' : 'Launch in progress')
                  : campaign.scheduleMode === 'scheduled' ? 'Campaign scheduled' : 'Campaign ready'}
              </div>
              <div className="text-theme-muted/60 text-base mt-1">
                {campaign.status === 'generating'
                  ? statusLine
                  : campaign.scheduleMode === 'scheduled' && (campaign.scheduledLaunchAt || campaign.startDate)
                    ? `${campaign.content?.length || 0} posts scheduled starting ${formatScheduleDate(campaign.scheduledLaunchAt || campaign.startDate)}`
                    : campaign.error || `${campaign.content?.length || 0} posts across ${(campaign.platforms || []).join(', ')}`}
              </div>
              {campaign.status === 'generating' && missingIntegrations.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-theme-text flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Social channels required to publish</p>
                    <p className="text-theme-muted/70 mt-1">
                      Connect {missingIntegrations.map(formatPlatform).join(', ')} in Social Channels before posts can go live.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/channels')}
                      className="mt-2 text-sm font-semibold text-curi-pink hover:underline"
                    >
                      Connect social channels →
                    </button>
                  </div>
                </div>
              )}
              {campaign.status === 'generating' && missingIntegrations.length === 0 && connectedChannelsLabel && (
                <p className="text-xs text-theme-muted/50 mt-2">
                  Publishing to {connectedChannelsLabel}. Posts will appear in Approvals when generation finishes.
                </p>
              )}
              {campaign.status === 'draft' && campaign.error && (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-theme-text flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{campaign.error}</span>
                </div>
              )}
              <div className="mt-4 h-2 bg-theme-subtle/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-curi-gradient rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {(campaign.status === 'generating' || campaign.content?.length > 0) && (
              <LaunchCalendar campaign={campaign} />
            )}

            {campaign.strategy && (
              <div className="page-card">
                <div className="section-label mb-2">Strategy</div>
                <p className="text-theme-muted/70 text-base whitespace-pre-wrap">{campaign.strategy}</p>
              </div>
            )}

            {(campaign.status === 'review' || campaign.status === 'draft') && campaign.content?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate('/approvals')} className="btn-primary flex-1 py-3 text-base">
                  Review in Approvals
                </button>
                <button type="button" onClick={sendToApprovals} className="btn-secondary py-3 text-base px-5">
                  Re-queue
                </button>
              </div>
            )}

            {campaign.scheduleMode === 'scheduled' && campaign.status === 'active' && campaign.content?.length > 0 && (
              <div className="page-card border border-curi-blue/20 bg-curi-blue/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-theme-text">Scheduled posts</div>
                    <p className="text-sm text-theme-muted/60 mt-1">
                      {campaign.content?.length || 0} posts are on your publishing calendar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/scheduled?tab=launch')}
                    className="btn-primary py-2.5 px-4 text-sm"
                  >
                    View Scheduled Posts
                  </button>
                </div>
              </div>
            )}

            {campaign.scheduleMode === 'scheduled'
              && (campaign.status === 'review' || campaign.status === 'draft')
              && campaign.content?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={scheduleCampaign} className="btn-primary flex-1 py-3 text-base">
                  Schedule for {formatScheduleDate(campaign.scheduledLaunchAt || campaign.startDate || scheduleStartAt) || 'later'}
                </button>
              </div>
            )}

            {campaign.status === 'draft' && campaign.error && (
              <button
                type="button"
                className="btn-primary w-full py-3 text-base"
                onClick={() => { setCampaign(null); setLoading(false); pollingIdRef.current = null; loadOverview() }}
              >
                Try Launch Again
              </button>
            )}

            <LaunchActivity overview={overview} loading={loadingOverview} />

            <button
              type="button"
              className="btn-secondary w-full py-3 text-base"
              onClick={() => { setCampaign(null); setLoading(false); pollingIdRef.current = null; loadOverview() }}
            >
              Start Another Launch
            </button>
          </motion.div>
        )}
      </div>
    </PageShell>
  )
}
