import { useState } from 'react'
import { API } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

const ScoreBar = ({ label, score, color }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-theme-muted/70 text-sm font-medium">{label}</span>
      <span className={`font-bold text-lg ${color}`}>{score}/100</span>
    </div>
    <div className="h-2 bg-theme-subtle/10 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </div>
  </div>
)

export default function Roast() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  const roast = async () => {
    if (!url) return toast.error('Enter a URL')
    setLoading(true)
    try {
      const { data } = await API.post('/discover/roast', { url })
      setResult(data.roast)
    } catch {
      toast.error('Roast failed — check the URL')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-theme-bg p-8 flex flex-col items-center relative overflow-hidden">
      <div className="blob-bg w-72 h-72 bg-curi-pink top-[-3rem] left-[-2rem] animate-float" />
      <div className="blob-bg w-48 h-48 bg-curi-blue bottom-[5%] right-[5%] animate-float-delayed" />

      <div className="absolute top-8 right-8 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10">
          <img
            src="/images/curi-mascot.png"
            alt="Curi mascot"
            className="w-24 h-24 mx-auto object-contain mb-4 animate-float"
          />
          <h1 className="text-4xl font-extrabold text-theme-text mb-2">Curi Roast</h1>
          <p className="text-theme-muted/50 font-medium">
            Get your website brutally (but lovingly) scored. Free, no login required.
          </p>
        </div>

        <div className="card p-6 mb-6">
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="https://yourwebsite.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && roast()}
            />
            <button onClick={roast} disabled={loading} className="btn-primary px-6">
              {loading ? 'Roasting...' : 'Roast It'}
            </button>
          </div>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="card p-6 text-center bg-gradient-to-br from-curi-pink/10 to-curi-blue/10 border-curi-pink/20">
              <div className="text-7xl font-black bg-curi-gradient bg-clip-text text-transparent mb-1">
                {result.overallScore}
              </div>
              <div className="text-theme-muted/40 text-sm mb-3 font-semibold">Overall Score</div>
              <p className="text-theme-text font-bold text-lg">"{result.roastHeadline}"</p>
            </div>

            <div className="card p-6">
              <ScoreBar label="Conversion" score={result.conversionScore} color="text-curi-green" />
              <ScoreBar label="Branding" score={result.brandingScore} color="text-curi-pink" />
              <ScoreBar label="Marketing" score={result.marketingScore} color="text-curi-blue" />
              <ScoreBar label="SEO" score={result.seoScore} color="text-curi-yellow" />
            </div>

            {[
              { label: 'Website', text: result.websiteRoast },
              { label: 'Conversion', text: result.conversionRoast },
              { label: 'Branding', text: result.brandingRoast },
              { label: 'Marketing', text: result.marketingRoast },
            ].map(r => (
              <div key={r.label} className="card p-4">
                <div className="text-xs font-bold text-theme-muted/40 uppercase tracking-wider mb-2">
                  {r.label}
                </div>
                <p className="text-theme-text/80 text-sm font-medium">{r.text}</p>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="text-xs font-bold text-curi-green uppercase tracking-wider mb-2">
                  What's Working
                </div>
                {result.topWins?.map((w, i) => (
                  <div key={i} className="text-theme-muted/70 text-sm py-1 font-medium">
                    • {w}
                  </div>
                ))}
              </div>
              <div className="card p-4">
                <div className="text-xs font-bold text-curi-pink uppercase tracking-wider mb-2">
                  Quick Wins
                </div>
                {result.topFixes?.map((f, i) => (
                  <div key={i} className="text-theme-muted/70 text-sm py-1 font-medium">
                    • {f}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => navigate('/auth')} className="btn-primary w-full py-3">
              Fix it all with Curi — Start Free →
            </button>
          </motion.div>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-theme-muted/30 text-sm hover:text-theme-muted/60 transition-colors font-semibold"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
