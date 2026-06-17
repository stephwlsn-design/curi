import { useState } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const DAY_OPTIONS = [30, 60, 90]

export default function Calendar() {
  const { workspaceId } = useAuth()
  const [days, setDays] = useState(30)
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState([])

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await API.post('/calendar/generate', { workspaceId, days, goal })
      setEntries(data.calendar || [])
      toast.success(`${days}-day calendar generated`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Calendar generation failed')
    } finally { setLoading(false) }
  }

  return (
    <PageShell>
      <PageHeader
        title="Curi Calendar"
        description="Auto-generate a content calendar with captions, platforms, and publish times. Schedule your next 30, 60, or 90 days in one click."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <div className="page-card">
          <div className="section-label mb-3">Calendar Length</div>
          <div className="flex gap-2">
            {DAY_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`flex-1 py-2.5 rounded-xl text-base font-bold transition-all ${days === d ? 'bg-curi-blue text-white' : 'bg-theme-subtle/5 text-theme-muted/60'}`}>
                {d} days
              </button>
            ))}
          </div>
        </div>
        <div className="page-card sm:col-span-1 xl:col-span-2">
          <div className="section-label mb-3">Campaign Goal</div>
          <input className="input" placeholder="E.g. product launch, brand awareness, lead generation..." value={goal} onChange={e => setGoal(e.target.value)} />
        </div>
      </div>

      <div className="page-card mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-theme-muted/50 font-medium">10 credits</span>
          <button onClick={generate} disabled={loading} className="btn-primary text-base px-6 py-3">
            {loading ? 'Generating...' : `Generate ${days}-Day Calendar`}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-theme-text">{entries.length} scheduled posts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {entries.map((entry, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                className="page-card flex gap-4 items-start">
                <div className="w-12 h-12 rounded-xl bg-curi-gradient flex items-center justify-center text-white font-black text-base flex-shrink-0">
                  {entry.day}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge bg-curi-pink/15 text-curi-pink capitalize">{entry.platform}</span>
                    <span className="badge bg-theme-subtle/10 text-theme-muted/60 capitalize">{entry.type}</span>
                    <span className="text-sm text-theme-muted/50 ml-auto">{entry.publishTime}</span>
                  </div>
                  <div className="font-bold text-theme-text text-base mb-1">{entry.topic}</div>
                  <p className="text-theme-muted/60 text-sm line-clamp-2">{entry.caption}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  )
}
