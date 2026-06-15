import { useState, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Link2, Calendar, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'

export default function BulkDesignUpload({ workspaceId, runId, entries = [], onComplete }) {
  const [files, setFiles] = useState([])
  const [mappings, setMappings] = useState({})
  const [autoMatch, setAutoMatch] = useState(true)
  const [scheduleAll, setScheduleAll] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [uploading, setUploading] = useState(false)

  const contentEntries = useMemo(() =>
    entries.filter(e => e.content || e.caption || e.topic).slice(0, 30),
  [entries])

  const defaultSchedule = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  const onDrop = (accepted) => {
    const newFiles = accepted.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      name: f.name,
    }))
    setFiles(prev => {
      const combined = [...prev, ...newFiles]
      if (autoMatch) {
        const next = { ...mappings }
        combined.forEach((f, i) => {
          if (contentEntries[i] && next[i] === undefined) {
            next[i] = contentEntries[i]._id
          }
        })
        setMappings(next)
      }
      return combined
    })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxSize: 12 * 1024 * 1024,
  })

  const removeFile = (i) => {
    setFiles(prev => {
      const next = [...prev]
      if (next[i]?.preview) URL.revokeObjectURL(next[i].preview)
      next.splice(i, 1)
      return next
    })
    setMappings(prev => {
      const next = { ...prev }
      delete next[i]
      return next
    })
  }

  const setMapping = (fileIndex, entryId) => {
    setMappings(prev => ({ ...prev, [fileIndex]: entryId }))
  }

  const submit = async () => {
    if (!runId) return toast.error('Select a campaign run first')
    if (!files.length) return toast.error('Upload at least one design')
    if (scheduleAll && !scheduledAt) return toast.error('Pick a schedule time')

    let assignments
    if (autoMatch) {
      assignments = files.map((_, i) => ({
        fileIndex: i,
        calendarEntryId: mappings[i] || contentEntries[i]?._id,
        scheduledAt: scheduleAll && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })).filter(a => a.calendarEntryId)
    } else {
      assignments = files.map((_, i) => ({
        fileIndex: i,
        calendarEntryId: mappings[i],
        scheduledAt: scheduleAll && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })).filter(a => a.calendarEntryId)
    }

    if (!assignments.length) return toast.error('Map each design to a content piece')

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('workspaceId', workspaceId)
      formData.append('assignments', JSON.stringify(assignments))
      formData.append('autoMatch', String(autoMatch))
      formData.append('scheduleAll', String(scheduleAll))
      if (scheduleAll && scheduledAt) {
        formData.append('scheduledAt', new Date(scheduledAt).toISOString())
      }
      files.forEach(f => formData.append('images', f.file))

      const { data } = await API.post(`/autonomous/run/${runId}/bulk-designs`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success(data.message)
      files.forEach(f => f.preview && URL.revokeObjectURL(f.preview))
      setFiles([])
      setMappings({})
      onComplete?.(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!runId) {
    return (
      <div className="card p-4 text-sm text-theme-muted/50">
        Run or load a campaign to bulk-upload designs against content pieces.
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-1">
          Bulk Upload Designs
        </div>
        <p className="text-xs text-theme-muted/40">
          Upload your own creatives and attach each one to a campaign content piece. Optionally schedule all at once.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer ${
          isDragActive ? 'border-curi-blue bg-curi-blue/5' : 'border-theme-border hover:border-curi-blue/40'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={20} className="mx-auto text-theme-muted/40 mb-1" />
        <p className="text-xs font-bold text-theme-muted/50">Drop multiple designs or click to browse</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {files.map((f, i) => (
            <div key={i} className="flex gap-3 items-center p-3 rounded-xl bg-theme-subtle/5 border border-theme-border">
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative">
                <img src={f.preview} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeFile(i)} className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 text-white">
                  <X size={10} />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-theme-text truncate">{f.name}</div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-theme-muted/40">
                  <Link2 size={10} />
                  Attach to content
                </div>
                <select
                  className="input text-xs mt-1 py-1"
                  value={mappings[i] || ''}
                  onChange={e => setMapping(i, e.target.value)}
                  disabled={autoMatch}
                >
                  <option value="">Select content piece...</option>
                  {contentEntries.map(e => (
                    <option key={e._id} value={e._id}>
                      Day {e.day} — {e.topic?.slice(0, 50) || 'Untitled'} ({e.platform})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoMatch} onChange={e => setAutoMatch(e.target.checked)} className="accent-curi-blue" />
          Auto-match to content in order
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleAll}
            onChange={e => {
              setScheduleAll(e.target.checked)
              if (e.target.checked && !scheduledAt) setScheduledAt(defaultSchedule())
            }}
            className="accent-curi-pink"
          />
          Schedule all uploads
        </label>
      </div>

      {scheduleAll && (
        <input
          type="datetime-local"
          className="input text-sm"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
        />
      )}

      <button
        type="button"
        onClick={submit}
        disabled={uploading || !files.length}
        className="btn-primary w-full text-sm flex items-center justify-center gap-2"
      >
        <Calendar size={16} />
        {uploading ? 'Uploading...' : `Attach ${files.length} Design(s) to Campaign`}
      </button>

      <p className="text-[10px] text-theme-muted/30">
        {contentEntries.length} content pieces available in this run
      </p>
    </div>
  )
}
