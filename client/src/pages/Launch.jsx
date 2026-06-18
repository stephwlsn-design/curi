import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const GOALS = [
  'Launch my AI startup',
  'Promote our new product feature',
  'Grow our LinkedIn following',
  'Drive traffic to our website',
  'Launch a seasonal sale campaign',
]

const DELIVERABLES = [
  { count: '20', label: 'Social posts across platforms' },
  { count: '5', label: 'Ad creatives (display + social)' },
  { count: '3', label: 'Email campaign templates' },
  { count: '2', label: 'Video scripts with storyboard' },
  { count: '1', label: 'Full launch strategy doc' },
  { count: '1', label: 'Publishing calendar' },
]

export default function Launch() {
  const { workspaceId, fetchMe } = useAuth()
  const navigate = useNavigate()
  const { workflow } = useCoreWorkflow()
  const [goal, setGoal] = useState('')
  const [timeline, setTimeline] = useState(30)
  const [budget, setBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [campaign, setCampaign] = useState(null)

  useDraftModule('launch', () => ({
    goal, timeline, budget, campaignId: campaign?._id, campaign,
  }), (s) => {
    if (s.goal) setGoal(s.goal)
    if (s.timeline) setTimeline(s.timeline)
    if (s.budget) setBudget(s.budget)
    if (s.campaign) setCampaign(s.campaign)
  })

  useEffect(() => {
    if (!goal && workflow.topic) setGoal(`Launch campaign around: ${workflow.topic}`)
    else if (!goal && workflow.contentText) setGoal(workflow.contentText.slice(0, 120))
  }, [workflow.topic, workflow.contentText])

  const pollCampaign = useCallback(async (id) => {
    try {
      const { data } = await API.get(`/launch/campaign/${id}`)
      setCampaign(data.campaign)
      if (data.campaign.status === 'generating') {
        setTimeout(() => pollCampaign(id), 3000)
      } else if (data.campaign.status === 'draft' || data.campaign.status === 'review') {
        toast.success(`Campaign ready — ${data.campaign.content?.length || 0} posts in approval queue`)
        setLoading(false)
        fetchMe?.()
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [fetchMe])

  const launch = async () => {
    if (!goal.trim()) return toast.error('Describe your campaign goal')
    setLoading(true)
    try {
      const { data } = await API.post('/launch/campaign', { workspaceId, goal, timeline, budget })
      setCampaign(data.campaign)
      toast.success('Campaign generation started!')
      pollCampaign(data.campaign._id)
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Launch failed')
      setLoading(false)
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

  const progress = campaign?.status === 'generating'
    ? Math.min(90, 10 + (campaign.content?.length || 0) * 4)
    : (campaign?.status === 'draft' || campaign?.status === 'review') ? 100 : 5

  return (
    <PageShell>
      <CoreWorkflowNav stepId="launch" hideNext />

      <PageHeader
        title="Curi Launch"
        description="Describe your goal. Get a complete campaign — posts, ads, emails, videos, and strategy — in one click."
      />

      {!campaign ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="page-card">
              <div className="section-label mb-2">Campaign Duration</div>
              <select className="input" value={timeline} onChange={e => setTimeline(Number(e.target.value))}>
                <option value={7}>1 week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <div className="page-card">
              <div className="section-label mb-2">Budget (optional)</div>
              <input className="input" placeholder="E.g. $5,000" value={budget} onChange={e => setBudget(e.target.value)} />
            </div>
          </div>

          <div className="page-card">
            <div className="section-label mb-3">What Curi will generate</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {DELIVERABLES.map(item => (
                <div key={item.label} className="flex items-center gap-3 bg-theme-subtle/5 rounded-xl p-4">
                  <span className="font-bold text-curi-pink text-xl">{item.count}</span>
                  <span className="text-theme-muted/60 text-base">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="page-card">
            <div className="section-label mb-3">What are you launching?</div>
            <textarea className="input resize-none h-32 text-base" placeholder="E.g. Launch my AI productivity app targeting remote teams..." value={goal} onChange={e => setGoal(e.target.value)} />
            <div className="mt-4">
              <div className="text-sm text-theme-muted/50 mb-2">Quick picks:</div>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setGoal(g)} className="badge bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text hover:bg-theme-subtle/10 transition-all cursor-pointer py-2 px-3 text-sm">{g}</button>
                ))}
              </div>
            </div>
            <button onClick={launch} disabled={loading} className="btn-primary w-full py-4 text-base mt-6">
              {loading ? 'Building your campaign...' : 'Launch Campaign — 50 Credits'}
            </button>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className={`page-card border ${campaign.status === 'review' || campaign.status === 'draft' ? 'bg-gradient-to-r from-curi-green/10 to-curi-blue/10 border-curi-green/20' : 'bg-gradient-to-r from-curi-pink/10 to-curi-blue/10 border-curi-pink/20'}`}>
            <div className="mb-2">
              <div className="font-bold text-theme-text text-lg">
                {campaign.status === 'generating' ? 'Campaign generation in progress' : 'Campaign ready for approval'}
              </div>
              <div className="text-theme-muted/60 text-base mt-1">
                {campaign.status === 'generating'
                  ? 'Your content is being generated. This takes 2–3 minutes.'
                  : `${campaign.content?.length || 0} posts queued for review in Approvals`}
              </div>
            </div>
            <div className="mt-4 h-2 bg-theme-subtle/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-curi-gradient rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="page-card">
            <div className="section-label mb-1">Campaign Goal</div>
            <div className="text-theme-text font-medium text-base">{campaign.goal}</div>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="badge bg-theme-subtle/5 text-theme-muted/60">{timeline} days</span>
              <span className="badge bg-theme-subtle/5 text-theme-muted/60 capitalize">{campaign.status}</span>
              {campaign.content?.length > 0 && (
                <span className="badge bg-curi-green/15 text-curi-green">{campaign.content.length} posts</span>
              )}
            </div>
          </div>

          {campaign.strategy && (
            <div className="page-card">
              <div className="section-label mb-2">Strategy</div>
              <p className="text-theme-muted/70 text-base whitespace-pre-wrap line-clamp-8">{campaign.strategy}</p>
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

          <button type="button" className="btn-secondary w-full py-3 text-base" onClick={() => { setCampaign(null); setLoading(false) }}>Start Another Campaign</button>
        </motion.div>
      )}
    </PageShell>
  )
}
