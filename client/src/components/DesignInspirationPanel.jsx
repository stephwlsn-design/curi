import { useRef, useState, useEffect } from 'react'
import { Upload, Sparkles, X, Loader2, ImageIcon, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'
import { POST_FORMATS, getPostFormat, getDimensionOptions } from '../constants/postFormats'

export default function DesignInspirationPanel({
  workspaceId,
  value,
  onChange,
  onExtract,
  onExtractCarousel,
  extracting = false,
  brief = '',
  postFormat = 'social_post',
  onPostFormatChange,
  dimensionId = '1080x1080',
  onDimensionChange,
  carouselSlideCount = 5,
  onCarouselSlideCountChange,
  embedded = false,
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState(null)
  const [notes, setNotes] = useState(value?.notes || '')

  const previewUrl = value?.previewDataUrl || value?.imageUrl || localPreview || null

  useEffect(() => () => {
    if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
  }, [localPreview])
  const format = getPostFormat(postFormat)
  const dimensionOptions = getDimensionOptions(postFormat)

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
        timeout: 55000,
      })
      onChange?.(data.designIdea)
      if (file) {
        if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
        setLocalPreview(null)
        toast.success(
          data.designIdea?.analyzedSpec
            ? 'Inspiration uploaded — style extracted'
            : 'Inspiration uploaded — you can create your design',
        )
      }
      return data.designIdea
    } catch (err) {
      const msg = err.code === 'ECONNABORTED'
        ? 'Upload timed out — try a smaller image or try again'
        : (err.response?.data?.error || err.message || 'Upload failed')
      toast.error(msg)
      if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
      return null
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
    const blobUrl = URL.createObjectURL(file)
    setLocalPreview(blobUrl)
    await saveIdea(file, notes)
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
  }

  const handleExtract = () => {
    if (!previewUrl && !notes.trim()) {
      toast.error('Upload an inspiration image or add notes first')
      return
    }
    if (postFormat === 'carousel') {
      onExtractCarousel?.(value)
      return
    }
    onExtract?.(value)
  }

  return (
    <div className={embedded ? 'space-y-4' : 'card p-5 space-y-4'}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon size={20} className="text-curi-pink" />
          <h3 className="text-base font-bold text-theme-text">Design inspiration</h3>
        </div>
        <p className="text-sm text-theme-muted/60 leading-relaxed">
          Upload a reference image. We extract colors, layout, and typography style only — all text from the reference is removed. Your brief supplies the copy.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {previewUrl || uploading ? (
        <div className="relative rounded-xl overflow-hidden border border-theme-border">
          {previewUrl ? (
            <img src={previewUrl} alt="Inspiration reference" className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 flex items-center justify-center bg-theme-subtle/5">
              <Loader2 size={28} className="animate-spin text-curi-pink" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-white" />
              <span className="text-xs font-bold text-white">Uploading & analyzing…</span>
            </div>
          )}
          <button
            type="button"
            onClick={clearIdea}
            className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
            title="Remove"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-bold">
            Aesthetics only — text stripped
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-theme-border rounded-xl p-8 flex flex-col items-center gap-2 hover:border-curi-pink/40 hover:bg-curi-pink/5 transition-all"
        >
          {uploading ? <Loader2 size={28} className="animate-spin text-curi-pink" /> : <Upload size={28} className="text-theme-muted/40" />}
          <span className="text-sm font-bold text-theme-muted/60">
            {uploading ? 'Uploading & analyzing…' : 'Upload design inspiration'}
          </span>
        </button>
      )}

      <textarea
        className="input resize-none h-20 text-sm"
        placeholder="Optional notes — mood, color hints, layout style (not text from the image)…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== (value?.notes || '')) saveIdea(null, notes)
        }}
      />

      <div>
        <div className="text-sm font-bold text-theme-text mb-2">Asset type</div>
        <div className="grid grid-cols-2 gap-2">
          {POST_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onPostFormatChange?.(f.id)
                onDimensionChange?.(f.defaultDimension)
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                postFormat === f.id
                  ? 'border-curi-pink bg-curi-pink/10'
                  : 'border-theme-border hover:border-curi-pink/30'
              }`}
            >
              <div className="text-sm font-bold text-theme-text">{f.label}</div>
              <div className="text-xs text-theme-muted/50 mt-0.5">{f.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-theme-text mb-2">Dimensions</div>
        <div className="flex flex-wrap gap-2">
          {dimensionOptions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDimensionChange?.(d.id)}
              className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
                dimensionId === d.id
                  ? 'bg-curi-blue text-white border-curi-blue'
                  : 'border-theme-border text-theme-muted/70 hover:border-curi-blue/40'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-theme-muted/50 mt-1.5">
          {format.label} · {dimensionId.replace('x', ' × ')} px
        </p>
      </div>

      {postFormat === 'carousel' && (
        <div>
          <div className="text-sm font-bold text-theme-text mb-2">Carousel slides</div>
          <div className="flex flex-wrap gap-2">
            {[3, 5, 7, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCarouselSlideCountChange?.(n)}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
                  carouselSlideCount === n
                    ? 'bg-curi-pink text-white border-curi-pink'
                    : 'border-theme-border text-theme-muted/70'
                }`}
              >
                {n} slides
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleExtract}
        disabled={extracting || uploading || (!previewUrl && !notes.trim())}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
      >
        {extracting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
        {postFormat === 'carousel'
          ? `Create ${carouselSlideCount}-slide carousel`
          : `Create ${format.label.toLowerCase()}`}
      </button>

      {postFormat === 'carousel' && (
        <button
          type="button"
          onClick={() => onExtract?.(value)}
          disabled={extracting || uploading || (!previewUrl && !notes.trim())}
          className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
        >
          <Layers size={16} />
          Or create single slide only
        </button>
      )}

      {value?.analyzedDirection && (
        <p className="text-xs text-theme-muted/50 leading-relaxed border-t border-theme-border pt-3">
          <span className="font-bold text-theme-text">Style detected: </span>
          {value.analyzedDirection}
        </p>
      )}
    </div>
  )
}
