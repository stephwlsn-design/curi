import { useRef, useState } from 'react'
import { Upload, Sparkles, X, Loader2, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'

export default function DesignInspirationBar({
  workspaceId,
  value,
  onChange,
  onExtract,
  extracting = false,
  brief = '',
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState(value?.notes || '')

  const previewUrl = value?.imageUrl || null

  const saveIdea = async (file, noteText = notes) => {
    if (!workspaceId) return null
    if (!file && !noteText?.trim()) {
      onChange?.(null)
      return null
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
      if (file) toast.success('Inspiration uploaded — ready to extract')
      return data.designIdea
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const idea = await saveIdea(file, notes)
    if (idea?.analyzedSpec && onExtract) {
      onExtract(idea)
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
  }

  const handleExtract = () => {
    if (!previewUrl && !notes.trim()) {
      toast.error('Upload an inspiration image or add notes first')
      return
    }
    onExtract?.(value)
  }

  return (
    <div className="px-4 py-2.5 bg-theme-subtle/5 border-b border-theme-border">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <ImageIcon size={16} className="text-curi-pink flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-theme-text leading-tight">Design inspiration</div>
            <div className="text-[10px] text-theme-muted/50 leading-tight hidden sm:block">
              Upload a reference — we extract layout, colors & typography onto the canvas
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            className="hidden"
            onChange={onFileChange}
          />

          {previewUrl ? (
            <div className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-theme-border">
              <img src={previewUrl} alt="Inspiration" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearIdea}
                className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity"
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
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-theme-border hover:border-curi-pink/40 text-[11px] font-bold text-theme-muted/60 hover:text-theme-text transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload reference
            </button>
          )}

          <input
            type="text"
            className="input flex-1 min-w-0 py-1.5 text-xs"
            placeholder="Optional notes — mood, colors, layout hints…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (value?.notes || '')) saveIdea(null, notes)
            }}
          />

          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || uploading || (!previewUrl && !notes.trim())}
            className="btn-primary flex-shrink-0 text-[11px] py-2 px-3 flex items-center gap-1.5 whitespace-nowrap"
          >
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Extract to canvas
          </button>
        </div>
      </div>

      {value?.analyzedDirection && (
        <p className="text-[10px] text-theme-muted/45 mt-1.5 line-clamp-2 lg:ml-[calc(1rem+16px+0.5rem)]">
          {value.analyzedDirection}
        </p>
      )}

      {!previewUrl && !notes && brief && (
        <p className="text-[10px] text-curi-blue/80 mt-1 lg:ml-[calc(1rem+16px+0.5rem)]">
          Tip: upload the design you shared earlier, or describe your ideal design in the brief and hit Extract.
        </p>
      )}
    </div>
  )
}
