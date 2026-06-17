import { useState } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'
import { isDraftDesign } from '../utils/localDesign'

const PLATFORMS = ['instagram', 'linkedin', 'twitter', 'facebook', 'tiktok', 'universal']

const defaultSchedule = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString().slice(0, 16)
}

export default function DesignSchedulePanel({ design, workspaceId, onScheduled }) {
  const [platform, setPlatform] = useState('instagram')
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule)
  const [scheduling, setScheduling] = useState(false)

  const canSchedule = design?._id && !isDraftDesign(design)

  const schedule = async () => {
    if (!canSchedule) {
      return toast.error('Save your design to the library first, then schedule')
    }
    if (!scheduledAt) return toast.error('Pick a date and time')

    setScheduling(true)
    try {
      const { data } = await API.post(`/design/${design._id}/schedule`, {
        workspaceId,
        platform,
        scheduledAt: new Date(scheduledAt).toISOString(),
      })
      toast.success(data.message || 'Design scheduled for publishing')
      onScheduled?.(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not schedule design')
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="card p-3 space-y-3 border border-curi-blue/20 bg-curi-blue/5">
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-curi-blue" />
        <span className="text-xs font-bold text-theme-text uppercase tracking-wider">Schedule post</span>
      </div>
      <p className="text-[10px] text-theme-muted/60 leading-snug">
        Publish this creative to your calendar. Save the design first if you haven&apos;t already.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-theme-muted/50 uppercase">Platform</label>
          <select className="input mt-1 text-xs" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-theme-muted/50 uppercase">Date & time</label>
          <input
            type="datetime-local"
            className="input mt-1 text-xs"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={schedule}
        disabled={scheduling || !canSchedule}
        className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {scheduling ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
        {canSchedule ? 'Schedule for publishing' : 'Save design first to schedule'}
      </button>
    </div>
  )
}
