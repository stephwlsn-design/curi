import { useRef, useState, useEffect } from 'react'
import { API } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Upload, X, ImageIcon } from 'lucide-react'

export default function DesignIdeaUpload({ workspaceId, value, onChange, compact = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState(value?.notes || '')

  useEffect(() => {
    setNotes(value?.notes || '')
  }, [value?.notes, value?.imageUrl])

  const saveIdea = async (file, noteText) => {
    if (!workspaceId) return
    if (!file && !noteText?.trim()) {
      onChange?.(null)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('workspaceId', workspaceId)
      formData.append('notes', noteText || '')
      if (file) formData.append('image', file)

      const { data } = await API.post('/design/idea', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onChange?.(data.designIdea)
      toast.success(file ? 'Design idea uploaded' : 'Design idea saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    saveIdea(file, notes)
    e.target.value = ''
  }

  const onNotesBlur = () => {
    if (notes !== (value?.notes || '')) {
      saveIdea(null, notes)
    }
  }

  const clearIdea = async () => {
    setNotes('')
    onChange?.(null)
    if (workspaceId) {
      try {
        const formData = new FormData()
        formData.append('workspaceId', workspaceId)
        formData.append('notes', '')
        await API.post('/design/idea', formData)
      } catch { /* ignore */ }
    }
    toast.success('Design idea cleared')
  }

  const previewUrl = value?.imageUrl || null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider">
        Design Idea {compact ? '' : '(optional)'}
      </div>
      <p className="text-sm text-theme-muted/60 leading-relaxed">
        Upload a reference image or describe your visual direction. Generated designs will use your reference as the visual base — same layout, colors, and style with your copy on top.
      </p>

      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-theme-border">
          <img src={previewUrl} alt="Design reference" className="w-full h-36 object-cover" />
          <button
            type="button"
            onClick={clearIdea}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-theme-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-curi-pink/40 hover:bg-curi-pink/5 transition-all"
        >
          <Upload size={22} className="text-theme-muted/40" />
          <span className="text-sm font-bold text-theme-muted/60">
            {uploading ? 'Uploading...' : 'Upload reference image'}
          </span>
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <textarea
        className="input resize-none h-24 text-base"
        placeholder="Describe the look you want — colors, layout, mood, typography..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={onNotesBlur}
      />

      {(value?.notes || value?.imageUrl) && (
        <div className="flex items-center gap-2 text-sm text-curi-green font-medium">
          <ImageIcon size={16} />
          {value?.imageUrl
            ? 'Reference image locked — designs will replicate this look'
            : 'Creative notes will guide design generation'}
        </div>
      )}
    </div>
  )
}
