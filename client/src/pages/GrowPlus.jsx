import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { API, useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import { GROW_PLATFORM_META, formatGrowPrice } from '../constants/growPlus'
import {
  TrendingUp, Users, Shield, Globe, CheckCircle2, Rocket,
  BarChart3, Sparkles, ArrowRight, Zap, Pause, Play, Download, RefreshCw, Mail,
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

const GUEST_CAMPAIGNS_KEY = 'curi_grow_guest_campaigns'

const loadGuestCampaigns = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_CAMPAIGNS_KEY) || '[]')
  } catch {
    return []
  }
}

const saveGuestCampaign = (campaign) => {
  const existing = loadGuestCampaigns()
  localStorage.setItem(GUEST_CAMPAIGNS_KEY, JSON.stringify([campaign, ...existing]))
}

function CampaignCard({
  campaign, user, guestEmail, workspaceId, onUpdate, onRefresh,
}) {
  const [expanded, setExpanded] = useState(false)
  const m = campaign.metrics || {}
  const progress = m.progressPct || 0

  const downloadReport = async () => {
    try {
      const params = { format: 'download' }
      const path = user
        ? `/grow/campaigns/${campaign._id}/report`
        : `/grow/public/campaigns/${campaign._id}/report`
      if (user) params.workspaceId = workspaceId
      else params.guestEmail = guestEmail

      const { data } = await API.get(path, { params, responseType: 'blob' })
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grow-plus-${campaign._id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download report')
    }
  }

  const togglePause = async () => {
    try {
      const action = campaign.status === 'paused' ? 'resume' : 'pause'
      const { data } = await API.post(`/grow/campaigns/${campaign._id}/${action}`, { workspaceId })
      onUpdate(data.campaign)
      toast.success(action === 'pause' ? 'Campaign paused' : 'Campaign resumed')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="font-bold text-theme-text text-lg">{campaign.name}</div>
          <div className="text-sm text-theme-muted/55 capitalize mt-1">
            {campaign.status?.replace(/_/g, ' ')} · {campaign.objective?.replace(/_/g, ' ')}
          </div>
          {campaign.invoiceNumber && (
            <div className="text-xs text-theme-muted/40 mt-1">Invoice {campaign.invoiceNumber}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { label: 'Budget', value: `$${campaign.budgetUsd}`, color: 'text-curi-green' },
            { label: 'Spend', value: m.spend ? `$${m.spend}` : '—' },
            { label: 'Followers', value: m.followersGained || '—' },
            { label: 'Quality', value: m.qualityScore ? `${m.qualityScore}%` : '—' },
            { label: 'CPA', value: m.costPerFollower ? `$${m.costPerFollower}` : '—' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="text-theme-muted/45 text-xs">{label}</div>
              <div className={`font-bold ${color || ''}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {campaign.status === 'active' && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-theme-muted/50 mb-1">
            <span>Campaign progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-theme-subtle/10 rounded-full overflow-hidden">
            <div className="h-full bg-curi-green rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" onClick={() => setExpanded(!expanded)} className="btn-secondary text-xs py-1.5 px-3">
          {expanded ? 'Hide details' : 'View analytics'}
        </button>
        <button type="button" onClick={downloadReport} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1">
          <Download size={14} /> Report
        </button>
        <button type="button" onClick={() => onRefresh(campaign._id)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1">
          <RefreshCw size={14} /> Refresh
        </button>
        {user && ['active', 'paused', 'review'].includes(campaign.status) && (
          <button type="button" onClick={togglePause} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1">
            {campaign.status === 'paused' ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-theme-border space-y-4">
          {campaign.platformMetrics?.length > 0 && (
            <div>
              <div className="text-xs font-bold text-theme-muted/50 uppercase mb-2">Platform breakdown</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {campaign.platformMetrics.map((pm) => (
                  <div key={pm.platform} className="bg-theme-subtle/5 rounded-lg p-3 text-sm">
                    <div className="font-bold capitalize">{pm.platform}</div>
                    <div className="text-theme-muted/55 text-xs mt-1">
                      Reach {pm.reach?.toLocaleString()} · Followers +{pm.followersGained} · Spend ${pm.spend}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {campaign.executionLog?.length > 0 && (
            <div>
              <div className="text-xs font-bold text-theme-muted/50 uppercase mb-2">Execution log</div>
              <ul className="space-y-1 max-h-40 overflow-y-auto text-xs text-theme-muted/60">
                {[...campaign.executionLog].reverse().map((log, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-curi-green shrink-0">{new Date(log.at).toLocaleString()}</span>
                    <span className="font-semibold capitalize">{log.step?.replace(/_/g, ' ')}</span>
                    <span>{log.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GrowPlus() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, workspaceId } = useAuth()
  const [catalog, setCatalog] = useState(null)
  const [pricingTab, setPricingTab] = useState('packages')
  const [selectedPackage, setSelectedPackage] = useState('growth')
  const [selectedPlan, setSelectedPlan] = useState('growth_sub')
  const [campaigns, setCampaigns] = useState([])
  const [guestCampaigns, setGuestCampaigns] = useState(() => loadGuestCampaigns())
  const [submitting, setSubmitting] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState([])
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    guestEmail: '',
    guestName: '',
    objective: 'followers',
    platforms: ['instagram', 'facebook'],
    targetGeography: 'Global',
    targetAudience: '',
    socialHandle: '',
    socialPlatform: 'instagram',
    linkedSocialPlatform: '',
  })

  useEffect(() => {
    API.get('/grow/catalog')
      .then(({ data }) => setCatalog(data))
      .catch(() => toast.error('Could not load Grow+ catalog'))
  }, [])

  const loadUserCampaigns = useCallback(() => {
    if (!workspaceId || !user) return
    API.get(`/grow/campaigns?workspaceId=${workspaceId}`)
      .then(({ data }) => setCampaigns(data.campaigns || []))
      .catch(() => {})
  }, [workspaceId, user])

  useEffect(() => { loadUserCampaigns() }, [loadUserCampaigns])

  useEffect(() => {
    if (!user) return
    API.get('/grow/connected-accounts')
      .then(({ data }) => setConnectedAccounts(data.accounts || []))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')
    const emailParam = searchParams.get('email')

    if (emailParam && !user) {
      setLookupEmail(emailParam)
      setForm((f) => ({ ...f, guestEmail: emailParam }))
    }

    if (checkout === 'success' && sessionId) {
      API.get(`/grow/checkout/complete?session_id=${sessionId}`)
        .then(({ data }) => {
          if (data.campaign) {
            if (user) setCampaigns((prev) => [data.campaign, ...prev.filter((c) => c._id !== data.campaign._id)])
            else {
              saveGuestCampaign(data.campaign)
              setGuestCampaigns((prev) => [data.campaign, ...prev.filter((c) => c._id !== data.campaign._id)])
            }
            toast.success('Payment confirmed — campaign deploying')
          }
          setSearchParams({}, { replace: true })
        })
        .catch(() => toast.error('Could not verify payment'))
    } else if (checkout === 'cancelled') {
      toast('Checkout cancelled', { icon: 'ℹ️' })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, user])

  const packages = catalog?.packages || []
  const subscriptions = catalog?.subscriptions || []
  const platforms = catalog?.platforms || []
  const objectives = catalog?.objectives || []

  const activePackage = useMemo(
    () => packages.find((p) => p.id === selectedPackage) || packages[1],
    [packages, selectedPackage],
  )

  const purchaseCampaign = async () => {
    if (!form.name.trim()) return toast.error('Enter a campaign name')
    if (!user && !form.guestEmail.trim()) return toast.error('Enter your email for order confirmation')
    if (user && !workspaceId) return toast.error('Workspace not loaded')
    if (pricingTab === 'packages' && activePackage?.custom) {
      return toast.error('Contact sales for Enterprise — use the inquiry form below')
    }

    setSubmitting(true)
    try {
      const body = {
        workspaceId: user ? workspaceId : undefined,
        guestEmail: user ? undefined : form.guestEmail.trim(),
        guestName: user ? undefined : form.guestName.trim(),
        name: form.name.trim(),
        packageId: pricingTab === 'packages' ? selectedPackage : undefined,
        subscriptionPlanId: pricingTab === 'subscriptions' ? selectedPlan : undefined,
        objective: form.objective,
        platforms: form.platforms,
        targetGeography: form.targetGeography,
        targetAudience: form.targetAudience,
        linkedSocialPlatform: form.linkedSocialPlatform || undefined,
        socialAccount: {
          platform: form.socialPlatform,
          handle: form.socialHandle,
        },
      }
      const { data } = await API.post('/grow/purchase', body)

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      if (data.message && !data.campaign) {
        toast.success(data.message)
        return
      }

      if (user) {
        setCampaigns((prev) => [data.campaign, ...prev])
      } else {
        saveGuestCampaign(data.campaign)
        setGuestCampaigns((prev) => [data.campaign, ...prev])
      }
      toast.success(data.message || 'Grow+ campaign activated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start campaign')
    } finally {
      setSubmitting(false)
    }
  }

  const fetchGuestOrders = async () => {
    if (!lookupEmail.trim()) return toast.error('Enter your email')
    setLookupLoading(true)
    try {
      const { data } = await API.get(`/grow/orders?email=${encodeURIComponent(lookupEmail.trim())}`)
      setGuestCampaigns(data.campaigns || [])
      localStorage.setItem(GUEST_CAMPAIGNS_KEY, JSON.stringify(data.campaigns || []))
      toast.success(`Found ${data.campaigns?.length || 0} order(s)`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load orders')
    } finally {
      setLookupLoading(false)
    }
  }

  const refreshCampaign = async (campaignId) => {
    try {
      if (user) {
        const { data } = await API.get(`/grow/campaigns/${campaignId}?workspaceId=${workspaceId}`)
        setCampaigns((prev) => prev.map((c) => (c._id === campaignId ? data.campaign : c)))
      } else {
        const email = lookupEmail || form.guestEmail
        if (!email?.trim()) return toast.error('Enter your email to refresh orders')
        const { data } = await API.get(`/grow/public/campaigns/${campaignId}?guestEmail=${encodeURIComponent(email.trim())}`)
        setGuestCampaigns((prev) => prev.map((c) => (c._id === campaignId ? data.campaign : c)))
      }
      toast.success('Metrics updated')
    } catch {
      toast.error('Could not refresh campaign')
    }
  }

  const updateCampaign = (updated) => {
    setCampaigns((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
  }

  const visibleCampaigns = user ? campaigns : guestCampaigns
  const guestEmailForCards = lookupEmail || form.guestEmail

  const togglePlatform = (id) => {
    setForm((f) => {
      const has = f.platforms.includes(id)
      if (has && f.platforms.length <= 1) return f
      return {
        ...f,
        platforms: has ? f.platforms.filter((p) => p !== id) : [...f.platforms, id],
      }
    })
  }

  return (
    <div className="min-h-screen bg-theme-bg relative overflow-x-hidden">
      <div className="blob-bg w-[420px] h-[420px] bg-curi-green/30 top-[-8rem] right-[-6rem] animate-float fixed" />
      <div className="blob-bg w-64 h-64 bg-curi-pink/25 bottom-[15%] left-[-4rem] animate-float-delayed fixed" />

      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-theme-bg/85 border-b border-theme-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/images/curi-mascot.png" alt="Curi" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-extrabold text-theme-text text-lg">Curi <span className="text-curi-green">Grow+</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="hidden sm:block text-sm font-semibold text-theme-muted/60 hover:text-curi-pink">Home</Link>
            <ThemeToggle />
            {user ? (
              <button type="button" onClick={() => navigate('/dashboard')} className="btn-primary text-sm py-2 px-4">
                Dashboard
              </button>
            ) : (
              <Link to="/auth/register?redirect=/grow" className="text-sm font-semibold text-theme-muted/60 hover:text-curi-pink px-2">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12 relative z-10">
        {/* Hero */}
        <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
          <span className="badge bg-curi-green/15 text-curi-green mb-4">Real audience growth · Policy compliant</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-theme-text mb-4 leading-tight">
            Buy a growth outcome,<br />
            <span className="text-curi-green">not fake followers</span>
          </h1>
          <p className="text-lg text-theme-muted/60 font-medium leading-relaxed">
            Grow+ deploys paid social, creator distribution, and content amplification across Instagram,
            Facebook, YouTube, TikTok, LinkedIn, and more — with quality monitoring and transparent reporting.
          </p>
        </motion.div>

        {/* Guardrails */}
        <motion.div {...fadeUp} className="grid sm:grid-cols-3 gap-4 mb-14">
          {[
            { icon: Shield, title: 'Real users only', desc: 'No bots, farms, or credential automation' },
            { icon: Globe, title: 'Cross-platform', desc: 'One dashboard for every major channel' },
            { icon: BarChart3, title: 'Outcome reporting', desc: 'See where growth came from' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5 text-center">
              <Icon className="w-8 h-8 mx-auto mb-2 text-curi-green" />
              <div className="font-bold text-theme-text mb-1">{title}</div>
              <div className="text-sm text-theme-muted/55">{desc}</div>
            </div>
          ))}
        </motion.div>

        {/* Pricing */}
        <motion.section {...fadeUp} id="pricing" className="mb-14">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-theme-text">Grow+ pricing</h2>
              <p className="text-sm text-theme-muted/55 mt-1">
                Separate from AI credits · 2.5–3× direct-cost model · 55–67% gross margin target
                {catalog?.paymentsEnabled ? ' · Stripe checkout enabled' : ' · Dev mode (instant activation)'}
              </p>
            </div>
            <div className="flex rounded-xl bg-theme-subtle/10 p-1">
              {['packages', 'subscriptions'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPricingTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                    pricingTab === tab ? 'bg-curi-green text-white shadow-clay-sm' : 'text-theme-muted/60'
                  }`}
                >
                  {tab === 'packages' ? 'Campaign packages' : 'Monthly plans'}
                </button>
              ))}
            </div>
          </div>

          {pricingTab === 'packages' ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => !pkg.custom && setSelectedPackage(pkg.id)}
                  className={`card p-6 text-left transition-all hover:scale-[1.01] ${
                    selectedPackage === pkg.id ? 'ring-2 ring-curi-green border-curi-green/40' : ''
                  } ${pkg.custom ? 'opacity-90' : 'cursor-pointer'}`}
                >
                  {pkg.popular && <span className="badge bg-curi-green/15 text-curi-green mb-2">Popular</span>}
                  <div className="font-extrabold text-xl text-theme-text">{pkg.name}</div>
                  <div className="text-2xl font-black text-curi-green my-2">
                    {formatGrowPrice(pkg.priceUsd, pkg.priceInr)}
                  </div>
                  <div className="text-xs text-theme-muted/50 mb-3">{pkg.bestFor}</div>
                  <div className="text-sm text-theme-muted/60 mb-4">{pkg.outcomes}</div>
                  <ul className="space-y-1.5">
                    {(pkg.features || []).map((f) => (
                      <li key={f} className="flex gap-2 text-xs text-theme-muted/70">
                        <CheckCircle2 size={14} className="text-curi-green shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {subscriptions.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`card p-6 text-left transition-all hover:scale-[1.01] ${
                    selectedPlan === plan.id ? 'ring-2 ring-curi-green border-curi-green/40' : ''
                  }`}
                >
                  {plan.popular && <span className="badge bg-curi-green/15 text-curi-green mb-2">Popular</span>}
                  <div className="font-extrabold text-lg text-theme-text">{plan.name}</div>
                  <div className="text-xl font-black text-curi-green my-2">
                    {formatGrowPrice(plan.priceUsd, plan.priceInr)}<span className="text-sm font-medium text-theme-muted/50">/mo</span>
                  </div>
                  <div className="text-xs text-theme-muted/50 mb-3">{plan.bestFor}</div>
                  <ul className="space-y-1.5">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex gap-2 text-xs text-theme-muted/70">
                        <CheckCircle2 size={14} className="text-curi-green shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* Platforms */}
        <motion.section {...fadeUp} className="mb-14">
          <h2 className="text-xl font-extrabold text-theme-text mb-4">Supported platforms</h2>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => {
              const meta = GROW_PLATFORM_META[p.id] || { label: p.label, className: 'bg-theme-subtle/10 text-theme-text' }
              return (
                <span key={p.id} className={`badge ${meta.className} text-sm py-1.5 px-3`}>
                  {meta.label}
                  {p.phase === 2 && <span className="ml-1 opacity-60 text-[10px]">soon</span>}
                </span>
              )
            })}
          </div>
        </motion.section>

        {/* Campaign builder */}
        <motion.section {...fadeUp} id="start" className="card p-6 md:p-8 mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Rocket className="text-curi-green" size={22} />
            <h2 className="text-xl font-extrabold text-theme-text">Start a Grow+ campaign</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {!user && (
                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-curi-green/5 border border-curi-green/20">
                  <div>
                    <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Email *</label>
                    <input
                      type="email"
                      className="input w-full"
                      placeholder="you@company.com"
                      value={form.guestEmail}
                      onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Name</label>
                    <input
                      className="input w-full"
                      placeholder="Your name"
                      value={form.guestName}
                      onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                    />
                  </div>
                  <p className="sm:col-span-2 text-xs text-theme-muted/50">
                    No account needed — we&apos;ll send campaign updates to this email.
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Campaign name</label>
                <input
                  className="input w-full"
                  placeholder="Q1 Instagram growth"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Objective</label>
                <select
                  className="input w-full"
                  value={form.objective}
                  onChange={(e) => setForm({ ...form, objective: e.target.value })}
                >
                  {objectives.map((o) => (
                    <option key={o.id} value={o.id}>{o.label} — {o.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-theme-muted/60 mb-2 block">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.filter((p) => p.phase === 1).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={`badge text-sm py-1.5 px-3 cursor-pointer transition-all ${
                        form.platforms.includes(p.id)
                          ? 'bg-curi-green/20 text-curi-green ring-1 ring-curi-green/40'
                          : 'bg-theme-subtle/10 text-theme-muted/60'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Target geography</label>
                  <input
                    className="input w-full"
                    value={form.targetGeography}
                    onChange={(e) => setForm({ ...form, targetGeography: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Social handle</label>
                  <input
                    className="input w-full"
                    placeholder="@yourbrand"
                    value={form.socialHandle}
                    onChange={(e) => setForm({ ...form, socialHandle: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Target audience</label>
                <input
                  className="input w-full"
                  placeholder="e.g. DTC skincare buyers, 25–40, US"
                  value={form.targetAudience}
                  onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                />
              </div>
              {user && connectedAccounts.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-theme-muted/60 mb-1 block">Connected account (OAuth)</label>
                  <select
                    className="input w-full"
                    value={form.linkedSocialPlatform}
                    onChange={(e) => setForm({ ...form, linkedSocialPlatform: e.target.value })}
                  >
                    <option value="">Manual handle only</option>
                    {connectedAccounts.map((a) => (
                      <option key={a.platform} value={a.platform}>
                        {a.platform} — {a.accountName || 'Connected'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-theme-muted/45 mt-1">
                    Link a connected account for live Meta insights in reporting.
                    <Link to="/settings?tab=publishing" className="text-curi-green ml-1">Connect more</Link>
                  </p>
                </div>
              )}
            </div>

            <div className="bg-curi-gradient-soft rounded-2xl p-6 border border-curi-green/20">
              <div className="text-sm font-bold text-theme-muted/50 uppercase tracking-wide mb-3">Order summary</div>
              <div className="text-2xl font-extrabold text-theme-text mb-1">
                {pricingTab === 'packages' ? activePackage?.name : subscriptions.find((s) => s.id === selectedPlan)?.name}
                {' '}package
              </div>
              <div className="text-3xl font-black text-curi-green mb-4">
                {pricingTab === 'packages'
                  ? formatGrowPrice(activePackage?.priceUsd, activePackage?.priceInr)
                  : `${formatGrowPrice(subscriptions.find((s) => s.id === selectedPlan)?.priceUsd, subscriptions.find((s) => s.id === selectedPlan)?.priceInr)}/mo`}
              </div>
              {activePackage?.outcomes && pricingTab === 'packages' && (
                <p className="text-sm text-theme-muted/60 mb-4">{activePackage.outcomes}</p>
              )}
              <ul className="space-y-2 mb-6 text-sm text-theme-muted/70">
                <li className="flex gap-2"><TrendingUp size={16} className="text-curi-green" /> Paid social + creator blend</li>
                <li className="flex gap-2"><Users size={16} className="text-curi-green" /> Quality-adjusted acquisition</li>
                <li className="flex gap-2"><Zap size={16} className="text-curi-green" /> Live optimization & reporting</li>
              </ul>
              <p className="text-xs text-theme-muted/45 mb-4">
                Results vary by audience, content & platform. Ranges are indicative — not follower guarantees.
              </p>
              <button
                type="button"
                onClick={purchaseCampaign}
                disabled={submitting || (pricingTab === 'packages' && activePackage?.custom)}
                className="btn-primary w-full py-3 text-base disabled:opacity-50"
              >
                {submitting ? 'Processing…' : catalog?.paymentsEnabled ? 'Proceed to checkout' : 'Purchase & activate campaign'}
                {!submitting && <ArrowRight size={18} className="inline ml-1" />}
              </button>
              {!user && (
                <p className="text-xs text-center text-theme-muted/50 mt-3">
                  Already use Curi?{' '}
                  <Link to="/auth?redirect=/grow" className="text-curi-green font-semibold">Sign in</Link>
                  {' '}to link this campaign to your workspace.
                </p>
              )}
            </div>
          </div>
        </motion.section>

        {/* Guest order lookup */}
        {!user && (
          <motion.section {...fadeUp} className="card p-6 mb-14">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="text-curi-green" size={20} />
              <h2 className="text-lg font-extrabold text-theme-text">Track your orders</h2>
            </div>
            <p className="text-sm text-theme-muted/55 mb-4">Enter the email used at checkout to load all your Grow+ campaigns.</p>
            <div className="flex flex-wrap gap-2">
              <input
                className="input flex-1 min-w-[200px]"
                type="email"
                placeholder="you@company.com"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
              />
              <button type="button" onClick={fetchGuestOrders} disabled={lookupLoading} className="btn-primary px-5">
                {lookupLoading ? 'Loading…' : 'Find orders'}
              </button>
            </div>
          </motion.section>
        )}

        {/* Active campaigns */}
        {visibleCampaigns.length > 0 && (
          <motion.section {...fadeUp} className="mb-14">
            <h2 className="text-xl font-extrabold text-theme-text mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-curi-green" />
              {user ? 'Your Grow+ campaigns' : 'Your guest orders'}
            </h2>
            <div className="space-y-3">
              {visibleCampaigns.map((c) => (
                <CampaignCard
                  key={c._id}
                  campaign={c}
                  user={user}
                  guestEmail={guestEmailForCards}
                  workspaceId={workspaceId}
                  onUpdate={updateCampaign}
                  onRefresh={refreshCampaign}
                />
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  )
}
