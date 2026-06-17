import { useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Calendar, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'

const PLATFORMS = ['instagram', 'linkedin', 'twitter', 'facebook', 'tiktok', 'universal']

export default function UserDesignUpload({ workspaceId, platform: defaultPlatform = 'instagram', onUploaded }) {
  const [files, setFiles] = useState([])
  const [platform, setPlatform] = useState(defaultPlatform)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [uploading, setUploading] = useState(false)

  const defaultSchedule = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  const onDrop = (accepted) => {
    setFiles(prev => [...prev, ...accepted.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      name: f.name,
    }))])
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
  }

  const upload = async () => {
    if (!files.length) return toast.error('Add at least one design')
    if (scheduleEnabled && !scheduledAt) return toast.error('Pick a schedule date and time')

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('workspaceId', workspaceId)
      formData.append('platform', platform)
      files.forEach(f => formData.append('images', f.file))
      formData.append('titles', JSON.stringify(files.map(f => f.name.replace(/\.[^.]+$/, ''))))
      if (scheduleEnabled && scheduledAt) {
        formData.append('scheduledAt', new Date(scheduledAt).toISOString())
      }

      const { data } = await API.post('/design/upload', formData, {
        timeout: 90000,
      })

      toast.success(data.message)
      onUploaded?.(data.designs)
      files.forEach(f => f.preview && URL.revokeObjectURL(f.preview))
      setFiles([])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider">
        Upload Your Designs
      </div>
      <p className="text-sm text-theme-muted/60 leading-relaxed">
        Upload finished creatives from your computer. Optionally schedule them for publishing.
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-curi-pink bg-curi-pink/5' : 'border-theme-border hover:border-curi-pink/40'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={24} className="mx-auto text-theme-muted/40 mb-2" />
        <p className="text-sm font-bold text-theme-muted/60">Drop designs here or click to browse</p>
        <p className="text-xs text-theme-muted/40 mt-1">PNG, JPG, WebP, GIF — up to 12MB each</p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-theme-border aspect-square">
              <img src={f.preview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold text-theme-muted/50 uppercase">Platform</label>
          <select className="input mt-1" value={platform} onChange={e => setPlatform(e.target.value)}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-theme-muted/50 uppercase mt-1">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={e => {
                setScheduleEnabled(e.target.checked)
                if (e.target.checked && !scheduledAt) setScheduledAt(defaultSchedule())
              }}
              className="accent-curi-pink w-4 h-4"
            />
            Schedule upload
          </label>
          {scheduleEnabled && (
            <input
              type="datetime-local"
              className="input mt-1"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={upload}
        disabled={uploading || !files.length}
        className="btn-primary w-full text-base flex items-center justify-center gap-2 py-3"
      >
        <Calendar size={16} />
        {uploading ? 'Uploading...' : scheduleEnabled ? `Upload & Schedule ${files.length} Design(s)` : `Upload ${files.length || ''} Design(s)`}
      </button>
    </div>
  )
}
