import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function Discover() {
  const { workspaceId, setWorkspace, fetchMe, workspace } = useAuth()
  const { markDiscoverComplete } = useCoreWorkflow()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(workspace?.brandProfile?.name ? workspace.brandProfile : null)

  useDraftModule('discover', () => ({ url, profile }), (s) => {
    if (s.url) setUrl(s.url)
    if (s.profile) setProfile(s.profile)
  })

  const analyze = async () => {
    if (!url.trim()) return toast.error('Enter a URL first')
    if (!workspaceId) return toast.error('Workspace not loaded — please sign out and sign in again')
    setLoading(true)
    try {
      const { data } = await API.post('/discover', { url: url.trim(), workspaceId })
      if (!data?.brandProfile?.name) {
        return toast.error('No brand data returned — try a different URL')
      }
      setProfile(data.brandProfile)
      setWorkspace(prev => prev ? { ...prev, brandProfile: data.brandProfile } : prev)
      markDiscoverComplete()
      fetchMe?.()
      if (data.source === 'scrape' || data.note) {
        toast.success(data.note || 'Brand profile built from website metadata')
      } else {
        toast.success('Brand profile extracted!')
      }
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || (err.response?.status === 402 ? 'Not enough credits — you need 5 credits for Discover' : null)
        || (err.code === 'ERR_NETWORK' ? 'Cannot reach server — run npm run dev from the project root' : null)
        || 'Analysis failed'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="p-8 max-w-4xl">
      <CoreWorkflowNav
        stepId="discover"
        canProceed={!!(profile?.name || workspace?.brandProfile?.name)}
        proceedLabel="Continue to Create"
      />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Discover</h1>
        <p className="text-theme-muted/50">Enter any website URL and extract your complete brand identity automatically.</p>
      </div>

      <div className="card p-6 mb-6">
        <label className="label">Website URL</label>
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="https://yourwebsite.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
          />
          <button onClick={analyze} disabled={loading} className="btn-primary px-8">
            {loading ? 'Analyzing...' : 'Discover'}
          </button>
        </div>
        <p className="text-theme-muted/30 text-xs mt-2">Costs 5 AI credits. Extracts brand voice, colors, audience and more.</p>
      </div>

      {loading && (
        <div className="card p-8 text-center">
          <img src="/images/curi-mascot.png" alt="" className="w-16 h-16 mx-auto mb-4 animate-float object-contain" />
          <div className="text-theme-text font-semibold mb-1">Analyzing your brand...</div>
          <div className="text-theme-muted/40 text-sm">Extracting brand voice, colors, and marketing strategy</div>
          <div className="flex gap-2 justify-center mt-4 flex-wrap">
            {['Scraping site', 'Extracting colors', 'Analyzing voice', 'Building profile'].map((s, i) => (
              <motion.div key={s} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.6 }}
                className="badge bg-theme-subtle/5 text-theme-muted/50">{s}</motion.div>
            ))}
          </div>
        </div>
      )}

      {profile && !loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card p-6 bg-gradient-to-r from-curi-pink/10 to-curi-blue/10 border-curi-pink/20">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-curi-gradient flex items-center justify-center text-2xl font-black text-white">
                {profile.name?.[0] || '?'}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-theme-text">{profile.name}</h2>
                <p className="text-theme-muted/50 text-sm">{profile.industry}</p>
                <div className="flex gap-2 mt-2">
                  <span className="badge bg-curi-pink/20 text-curi-pink">{profile.voice}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Value Proposition</div>
              <p className="text-theme-text/80 text-sm leading-relaxed">{profile.valueProposition}</p>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Target Audience</div>
              <p className="text-theme-text/80 text-sm leading-relaxed">{profile.audience}</p>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Brand Colors</div>
              <div className="flex gap-2 flex-wrap">
                {profile.colors?.palette?.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-lg border border-theme-border" style={{ backgroundColor: c }} />
                    <span className="text-theme-muted/30 text-[10px] font-mono">{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Products & Services</div>
              <div className="space-y-1.5">
                {profile.products?.map((p, i) => (
                  <div key={i} className="text-sm text-theme-muted/70">{p}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Marketing Strategy</div>
            <p className="text-theme-text/80 text-sm leading-relaxed">{profile.marketingSummary}</p>
          </div>

          <div className="card p-5">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Keywords</div>
            <div className="flex flex-wrap gap-2">
              {profile.keywords?.map((k, i) => <span key={i} className="badge bg-theme-subtle/5 text-theme-muted/60">{k}</span>)}
            </div>
          </div>

          <button
            className="btn-primary w-full py-3"
            onClick={() => {
              markDiscoverComplete()
              toast.success('Brand profile saved to your workspace')
              navigate('/create')
            }}
          >
            Brand Profile Saved — Continue to Create
          </button>
        </motion.div>
      )}
    </div>
  )
}
