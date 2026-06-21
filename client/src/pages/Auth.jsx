import { useState, useEffect } from 'react'
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import ThemeToggle from '../components/ThemeToggle'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const initialMode = searchParams.get('invite') || location.pathname.endsWith('/register')
    ? 'register'
    : (searchParams.get('mode') === 'register' ? 'register' : 'login')
  const inviteToken = searchParams.get('invite') || ''

  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [inviteInfo, setInviteInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!inviteToken) return
    fetch(`/api/auth/invite/${inviteToken}`)
      .then(r => r.json())
      .then(data => {
        if (data.email) {
          setInviteInfo(data)
          setForm(f => ({ ...f, email: data.email }))
          setMode('register')
        }
      })
      .catch(() => {})
  }, [inviteToken])

  const handle = async (e) => {
    e.preventDefault()
    if (mode === 'register' && form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match')
    }
    if (mode === 'register' && form.password.length < 8) {
      return toast.error('Password must be at least 8 characters')
    }

    setLoading(true)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form.name, form.email, form.password, inviteToken || undefined)
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
      navigate('/dashboard')
    } catch (err) {
      const data = err.response?.data
      toast.error(data?.error || data?.errors?.[0]?.msg || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-theme-bg flex relative overflow-hidden">
      <div className="blob-bg w-96 h-96 bg-curi-pink top-[-6rem] left-[-4rem] animate-float" />
      <div className="blob-bg w-64 h-64 bg-curi-blue bottom-[-2rem] left-[30%] animate-float-delayed" />
      <div className="blob-bg w-40 h-40 bg-curi-yellow top-[20%] right-[10%] animate-float" />

      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 bg-curi-gradient-soft border-r border-theme-border relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <img
            src="/images/curi-mascot.png"
            alt="Curi mascot"
            className="w-40 h-40 object-contain mb-6 drop-shadow-clay animate-float"
          />
          <h1 className="text-5xl font-extrabold text-theme-text leading-tight mb-4">
            Your brand.
            <br />
            <span className="bg-curi-gradient bg-clip-text text-transparent">AI-powered.</span>
          </h1>
          <p className="text-theme-muted/60 text-lg mb-12 font-medium max-w-md">
            Turn any website URL into a full marketing engine. Posts, ads, videos, emails — all in your brand voice.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Brand Discovery', sub: 'URL to full brand profile' },
              { label: 'AI Content', sub: '6 platforms at once' },
              { label: 'Visual Studio', sub: 'On-brand creatives' },
              { label: 'Campaign Launch', sub: '20 posts in one click' },
            ].map(f => (
              <div key={f.label} className="card p-4 hover:scale-[1.02] transition-transform duration-200">
                <div className="font-bold text-theme-text text-sm">{f.label}</div>
                <div className="text-theme-muted/50 text-xs font-medium">{f.sub}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex-1 lg:max-w-lg flex items-center justify-center p-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="flex justify-end mb-4 lg:absolute lg:top-8 lg:right-8">
            <ThemeToggle />
          </div>

          <div className="text-center mb-8 lg:hidden">
            <img src="/images/curi-mascot.png" alt="Curi mascot" className="w-20 h-20 mx-auto object-contain mb-2" />
            <div className="text-2xl font-extrabold text-theme-text">Curi</div>
          </div>

          <h2 className="text-2xl font-extrabold text-theme-text mb-2">
            {inviteInfo ? 'Accept your invite' : mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-theme-muted/50 text-sm mb-6 font-medium">
            {inviteInfo
              ? `Join ${inviteInfo.workspaceName} as ${inviteInfo.role}`
              : mode === 'login'
                ? 'Sign in to your Curi account'
                : 'Free to start — no credit card needed'}
          </p>

          {inviteInfo && (
            <div className="mb-4 p-3 rounded-2xl bg-curi-pink/10 border border-curi-pink/20 text-sm">
              <div className="font-bold text-curi-pink mb-0.5">Team invitation</div>
              <div className="text-theme-muted/60">Use <strong>{inviteInfo.email}</strong> to join this workspace.</div>
            </div>
          )}

          <form onSubmit={handle} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  placeholder="Alex Smith"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                readOnly={!!inviteInfo}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            {mode === 'register' && (
              <div>
                <label className="label">Confirm Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : inviteInfo ? 'Create Account & Join' : 'Create Account'}
            </button>
          </form>

          {!inviteToken && (
            <p className="text-center text-theme-muted/50 text-sm mt-6 font-medium">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setMode(m => (m === 'login' ? 'register' : 'login'))}
                className="text-curi-pink hover:underline font-bold"
              >
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          )}

          <p className="text-center text-theme-muted/30 text-xs mt-4 font-medium flex flex-col gap-1">
            <Link to="/" className="hover:text-curi-pink transition-colors">← Back to home</Link>
            <Link to="/roast" className="hover:text-curi-pink transition-colors">Try Curi Roast — free, no login →</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
