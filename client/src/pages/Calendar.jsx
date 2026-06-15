import { useState } from 'react'
import { API, useAuth } from '../context/AuthContext'
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
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Calendar</h1>
        <p className="text-theme-muted/50">Auto-generate a content calendar with captions, platforms, and publish times. Schedule your next 30, 60, or 90 days in one click.</p>
      </div>

      <div className="card p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Calendar Length</div>
            <div className="flex gap-2">
              {DAY_OPTIONS.map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${days === d ? 'bg-curi-blue text-white' : 'bg-theme-subtle/5 text-theme-muted/50'}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Campaign Goal</div>
            <input className="input" placeholder="E.g. product launch, brand awareness, lead generation..." value={goal} onChange={e => setGoal(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-theme-muted/40">10 credits</span>
          <button onClick={generate} disabled={loading} className="btn-primary">
            {loading ? 'Generating...' : `Generate ${days}-Day Calendar`}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-theme-text">{entries.length} scheduled posts</h2>
          {entries.map((entry, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
              className="card p-4 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-curi-gradient flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {entry.day}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-curi-pink/15 text-curi-pink capitalize">{entry.platform}</span>
                  <span className="badge bg-theme-subtle/10 text-theme-muted/50 capitalize">{entry.type}</span>
                  <span className="text-xs text-theme-muted/40 ml-auto">{entry.publishTime}</span>
                </div>
                <div className="font-bold text-theme-text text-sm mb-1">{entry.topic}</div>
                <p className="text-theme-muted/60 text-sm line-clamp-2">{entry.caption}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
