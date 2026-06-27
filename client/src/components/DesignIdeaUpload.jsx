import { useRef, useState, useEffect } from 'react'
import { API } from '../context/AuthContext'
import { compressImageForInspiration, enrichDesignIdeaWithPreview } from '../utils/inspirationImage'
import toast from 'react-hot-toast'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'

export default function DesignIdeaUpload({ workspaceId, value, onChange, compact = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState(value?.notes || '')
  const [localPreview, setLocalPreview] = useState(null)

  const previewUrl = value?.previewDataUrl || value?.imageUrl || localPreview || null

  useEffect(() => {
    setNotes(value?.notes || '')
  }, [value?.notes, value?.imageUrl, value?.previewDataUrl])

  useEffect(() => () => {
    if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
  }, [localPreview])

  const saveIdea = async (file, noteText) => {
    if (!workspaceId) {
      toast.error('Workspace not loaded — sign in again')
      return
    }
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

      const { data } = await API.post('/design/idea', formData, { timeout: 55000 })
      let idea = data.designIdea
      if (file && !idea?.previewDataUrl) {
        idea = await enrichDesignIdeaWithPreview({
          ...idea,
          imageUrl: idea?.imageUrl || localPreview,
        })
      }
      onChange?.(idea)
      if (file) {
        if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
        setLocalPreview(null)
        toast.success(
          data.designIdea?.analyzedSpec
            ? 'Design reference uploaded — style extracted'
            : 'Design reference uploaded',
        )
      } else {
        toast.success('Design idea saved')
      }
    } catch (err) {
      const msg = err.code === 'ECONNABORTED'
        ? 'Upload timed out — try a smaller image'
        : (err.response?.data?.error || 'Upload failed')
      toast.error(msg)
      if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8 MB')
      return
    }
    const prepared = await compressImageForInspiration(file)
    const blobUrl = URL.createObjectURL(prepared)
    setLocalPreview(blobUrl)
    saveIdea(prepared, notes)
  }

  const onNotesBlur = () => {
    if (notes !== (value?.notes || '')) {
      saveIdea(null, notes)
    }
  }

  const clearIdea = async () => {
    setNotes('')
    if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
    setLocalPreview(null)
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

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider">
        Design Idea {compact ? '' : '(optional)'}
      </div>
      <p className="text-sm text-theme-muted/60 leading-relaxed">
        Upload a reference image or describe your visual direction. Generated designs will use your reference as the visual base — same layout, colors, and style with your copy on top.
      </p>

      {previewUrl || uploading ? (
        <div className="relative rounded-xl overflow-hidden border border-theme-border">
          {previewUrl ? (
            <img src={previewUrl} alt="Design reference" className="w-full h-36 object-cover" />
          ) : (
            <div className="w-full h-36 flex items-center justify-center bg-theme-subtle/5">
              <Loader2 size={24} className="animate-spin text-curi-pink" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <Loader2 size={22} className="animate-spin text-white" />
              <span className="text-xs font-bold text-white">Uploading & analyzing…</span>
            </div>
          )}
          <button
            type="button"
            onClick={clearIdea}
            disabled={uploading}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 disabled:opacity-50"
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
            Upload reference image
          </span>
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/*" className="hidden" onChange={onFileChange} />

      <textarea
        className="input resize-none h-24 text-base"
        placeholder="Describe the look you want — colors, layout, mood, typography..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={onNotesBlur}
        disabled={uploading}
      />

      {(value?.notes || value?.imageUrl || value?.previewDataUrl) && (
        <div className="flex items-center gap-2 text-sm text-curi-green font-medium">
          <ImageIcon size={16} />
          {value?.previewDataUrl || value?.imageUrl
            ? 'Reference image locked — designs will replicate this look'
            : 'Creative notes will guide design generation'}
        </div>
      )}
    </div>
  )
}
