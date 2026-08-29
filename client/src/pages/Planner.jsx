import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  Calendar, Upload, Image as ImageIcon, Send, Clock, Link2,
  CheckCircle2, AlertCircle, X, LayoutGrid,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'

const PLATFORM_META = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/15 text-[#0A66C2]' },
  twitter: { label: 'X (Twitter)', color: 'bg-theme-subtle/10 text-theme-text' },
  instagram: { label: 'Instagram', color: 'bg-curi-pink/15 text-curi-pink' },
  facebook: { label: 'Facebook', color: 'bg-curi-blue/15 text-curi-blue' },
}

const defaultSchedule = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString().slice(0, 16)
}

const formatWhen = (dateStr) => {
  if (!dateStr) return 'TBD'
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr)
  const time = format(d, 'h:mm a')
  if (isToday(d)) return `Today · ${time}`
  if (isTomorrow(d)) return `Tomorrow · ${time}`
  return format(d, 'EEE, MMM d · h:mm a')
}

export default function Planner() {
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram'])
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule)
  const [scheduleMode, setScheduleMode] = useState('schedule')
  const [submitting, setSubmitting] = useState(false)
  const [queue, setQueue] = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)

  const connectedPlatforms = useMemo(
    () => new Set(accounts.map((a) => a.platform)),
    [accounts],
  )

  const loadAccounts = async () => {
    setLoadingAccounts(true)
    try {
      const { data } = await API.get('/publish/accounts')
      setAccounts(data.accounts || [])
    } catch {
      toast.error('Could not load connected channels')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const loadQueue = async () => {
    if (!workspaceId) return
    setLoadingQueue(true)
    try {
      const { data } = await API.get(`/scheduled?workspaceId=${workspaceId}&source=planner`)
      setQueue((data.posts || []).slice(0, 8))
    } catch {
      /* queue preview optional */
    } finally {
      setLoadingQueue(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    loadQueue()
  }, [workspaceId])

  const onDrop = (accepted) => {
    const next = accepted[0]
    if (!next) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    if (!caption.trim()) {
      setCaption(next.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxSize: 12 * 1024 * 1024,
    multiple: false,
  })

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
  }

  const togglePlatform = (platform) => {
    setSelectedPlatforms((prev) => (
      prev.includes(platform)
        ? prev.length > 1 ? prev.filter((p) => p !== platform) : prev
        : [...prev, platform]
    ))
  }

  const uploadForPlatform = async (platform, when) => {
    const formData = new FormData()
    formData.append('workspaceId', workspaceId)
    formData.append('platform', platform)
    formData.append('module', 'planner')
    formData.append('caption', caption.trim())
    formData.append('titles', JSON.stringify([file.name.replace(/\.[^.]+$/, '')]))
    formData.append('captions', JSON.stringify([caption.trim()]))
    formData.append('images', file)
    if (when) {
      formData.append('scheduledAt', new Date(when).toISOString())
    }
    const { data } = await API.post('/design/upload', formData, { timeout: 90000 })
    return data
  }

  const publishNow = async (contentId, platform) => {
    await API.post('/publish/now', { contentId, platform })
  }

  const handleSubmit = async () => {
    if (!workspaceId) return toast.error('Workspace not loaded — refresh or sign in again')
    if (!file) return toast.error('Add an image or graphic to post')
    if (!caption.trim()) return toast.error('Write a caption for your post')
    if (!selectedPlatforms.length) return toast.error('Select at least one channel')
    if (scheduleMode === 'schedule' && !scheduledAt) return toast.error('Pick a date and time')

    const unconnected = selectedPlatforms.filter((p) => !connectedPlatforms.has(p))
    if (unconnected.length) {
      return toast.error(`Connect ${unconnected.join(', ')} in Social Channels first`)
    }

    setSubmitting(true)
    try {
      if (scheduleMode === 'now') {
        for (const platform of selectedPlatforms) {
          const { designs } = await uploadForPlatform(platform, null)
          const design = designs?.[0]
          if (design?._id) {
            await publishNow(design._id, platform)
          }
        }
        toast.success(`Published to ${selectedPlatforms.length} channel(s)`)
      } else {
        for (const platform of selectedPlatforms) {
          await uploadForPlatform(platform, scheduledAt)
        }
        toast.success(`Scheduled for ${selectedPlatforms.length} channel(s)`)
      }

      clearFile()
      setCaption('')
      loadQueue()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not schedule post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell wide>
      <PageHeader
        title="Planner"
        description="Upload your own graphics and schedule posts to social channels — separate from the Curi AI workflow."
        action={
          <button
            type="button"
            onClick={() => navigate('/scheduled?tab=planner')}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <LayoutGrid size={14} />
            Curi Scheduler
          </button>
        }
      />

      {!workspaceId && (
        <div className="page-card mb-6 text-sm text-theme-muted/60">
          We couldn&apos;t load your workspace yet. Complete onboarding in Brand Hub or refresh the page before scheduling posts.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Compose */}
        <div className="space-y-4">
          <div className="page-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-curi-pink" />
              <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider">Compose</h2>
            </div>

            {!preview ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragActive ? 'border-curi-pink bg-curi-pink/5' : 'border-theme-border hover:border-curi-pink/40'
                }`}
              >
                <input {...getInputProps()} />
                <Upload size={32} className="mx-auto text-theme-muted/40 mb-3" />
                <p className="font-bold text-theme-text">Drop your graphic here</p>
                <p className="text-sm text-theme-muted/50 mt-1">PNG, JPG, WebP, GIF — up to 12MB</p>
                <p className="text-xs text-theme-muted/40 mt-3">Use finished creatives from Canva, Figma, or your design tools</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-theme-border bg-theme-subtle/5">
                <img src={preview} alt="" className="w-full max-h-80 object-contain mx-auto" />
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">Caption</label>
              <textarea
                className="input mt-1.5 min-h-[120px] resize-y text-sm"
                placeholder="Write your post caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={2200}
              />
              <div className="text-[10px] text-theme-muted/40 mt-1 text-right">{caption.length} / 2200</div>
            </div>
          </div>

          {/* Queue preview */}
          <div className="page-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-curi-blue" />
                <h3 className="text-sm font-bold text-theme-text">Upcoming from Planner</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/scheduled?tab=planner')}
                className="text-xs text-curi-pink font-semibold hover:underline"
              >
                View all
              </button>
            </div>
            {loadingQueue ? (
              <p className="text-xs text-theme-muted/40">Loading queue...</p>
            ) : queue.length === 0 ? (
              <p className="text-xs text-theme-muted/50">No scheduled Planner posts yet. Compose above to add to your queue.</p>
            ) : (
              <div className="space-y-2">
                {queue.map((post) => (
                  <div key={post._id || post.jobId} className="flex gap-3 items-center p-2 rounded-xl bg-theme-subtle/5">
                    {post.mediaUrl && (
                      <img src={post.mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-theme-text truncate">{post.content || post.title}</div>
                      <div className="text-[10px] text-theme-muted/50 capitalize">{post.platform} · {formatWhen(post.scheduledAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Schedule panel */}
        <div className="space-y-4">
          <div className="page-card p-5 space-y-4 sticky top-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-curi-blue" />
              <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider">Schedule</h2>
            </div>

            <div>
              <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider mb-2 block">Channels</label>
              {loadingAccounts ? (
                <p className="text-xs text-theme-muted/40">Loading channels...</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(PLATFORM_META).map(([id, meta]) => {
                    const connected = connectedPlatforms.has(id)
                    const selected = selectedPlatforms.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePlatform(id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-curi-pink/40 bg-curi-pink/5'
                            : 'border-theme-border hover:border-theme-border/80'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected ? 'bg-curi-pink border-curi-pink text-white' : 'border-theme-border'
                        }`}
                        >
                          {selected && <CheckCircle2 size={10} />}
                        </span>
                        <span className={`badge text-[10px] ${meta.color}`}>{meta.label}</span>
                        <span className="ml-auto">
                          {connected
                            ? <CheckCircle2 size={14} className="text-curi-green" />
                            : <AlertCircle size={14} className="text-theme-muted/30" title="Not connected" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate('/channels')}
                className="mt-2 text-xs text-curi-blue font-semibold flex items-center gap-1 hover:underline"
              >
                <Link2 size={12} /> Manage Social Channels
              </button>
            </div>

            <div className="flex gap-2 p-1 bg-theme-subtle/5 rounded-xl">
              <button
                type="button"
                onClick={() => setScheduleMode('schedule')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  scheduleMode === 'schedule'
                    ? 'bg-theme-card shadow-sm text-theme-text ring-1 ring-theme-border/40'
                    : 'text-theme-muted/50 hover:text-theme-muted/70'
                }`}
              >
                Schedule
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('now')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  scheduleMode === 'now'
                    ? 'bg-theme-card shadow-sm text-theme-text ring-1 ring-theme-border/40'
                    : 'text-theme-muted/50 hover:text-theme-muted/70'
                }`}
              >
                Post now
              </button>
            </div>

            {scheduleMode === 'schedule' && (
              <div>
                <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">Date & time</label>
                <input
                  type="datetime-local"
                  className="input mt-1.5 w-full"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !file}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>Working...</>
              ) : scheduleMode === 'now' ? (
                <><Send size={16} /> Post now</>
              ) : (
                <><Calendar size={16} /> Add to queue</>
              )}
            </button>

            <p className="text-[10px] text-theme-muted/45 leading-snug">
              Planner posts are managed separately from Curi Launch and Autonomous. View them in Curi Scheduler.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
