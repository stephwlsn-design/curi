import { useRef, useState } from 'react'
import { Upload, Image as ImageIcon, Film, Layout, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import PexelsMediaPanel from './PexelsMediaPanel'

const MAX_IMAGE_MB = 10
const MAX_VIDEO_MB = 50

export default function DesignMediaPanel({
  workspaceId,
  mediaType = 'photos',
  compact = false,
  embedded = false,
  externalSearch,
  onPhotoSelect,
  onVideoSelect,
}) {
  const fileRef = useRef(null)
  const [tab, setTab] = useState('stock')
  const [pendingUpload, setPendingUpload] = useState(null)
  const isVideo = mediaType === 'videos'

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const isVid = file.type.startsWith('video/')
    const isImg = file.type.startsWith('image/')

    if (isVideo && !isVid) {
      toast.error('Choose an MP4, WebM, or MOV video')
      return
    }
    if (!isVideo && !isImg) {
      toast.error('Choose a JPG, PNG, or WebP image')
      return
    }

    const maxMb = isVid ? MAX_VIDEO_MB : MAX_IMAGE_MB
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File must be under ${maxMb} MB`)
      return
    }

    try {
      if (isVid) {
        const objectUrl = URL.createObjectURL(file)
        let poster = objectUrl
        try {
          poster = await readFile(file)
        } catch {
          // poster fallback
        }
        setPendingUpload({
          type: 'video',
          url: objectUrl,
          thumbnailUrl: poster,
          name: file.name,
          source: 'upload',
        })
      } else {
        const dataUrl = await readFile(file)
        setPendingUpload({
          type: 'photo',
          url: dataUrl,
          thumbnailUrl: dataUrl,
          name: file.name,
          source: 'upload',
        })
      }
    } catch {
      toast.error('Could not read file')
    }
  }

  const applyUpload = (useAs) => {
    if (!pendingUpload) return
    if (pendingUpload.type === 'video') {
      onVideoSelect?.(pendingUpload)
    } else {
      onPhotoSelect?.(pendingUpload, useAs)
    }
    setPendingUpload(null)
  }

  const clearPending = () => {
    if (pendingUpload?.type === 'video' && pendingUpload.url?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingUpload.url)
    }
    setPendingUpload(null)
  }

  return (
    <div className={embedded ? 'space-y-3' : 'card p-5'}>
      <div className="flex gap-1 p-1 rounded-xl bg-theme-subtle/5 border border-theme-border">
        <button
          type="button"
          onClick={() => { setTab('stock'); clearPending() }}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
            tab === 'stock' ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
          }`}
        >
          Stock
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
            tab === 'upload' ? 'bg-curi-blue text-white' : 'text-theme-muted/60'
          }`}
        >
          <Upload size={11} /> My Media
        </button>
      </div>

      {tab === 'stock' ? (
        <PexelsMediaPanel
          workspaceId={workspaceId}
          compact={compact}
          embedded
          fixedTab={isVideo ? 'videos' : 'photos'}
          externalSearch={externalSearch}
          onPhotoSelect={onPhotoSelect}
          onVideoSelect={onVideoSelect}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] text-theme-muted/55 leading-snug">
            Upload {isVideo ? 'a video' : 'an image'} from your device — use as a full canvas background or add as a movable layer.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={isVideo ? 'video/mp4,video/webm,video/quicktime,video/*' : 'image/png,image/jpeg,image/webp,image/*'}
            className="hidden"
            onChange={handleFile}
          />

          {!pendingUpload ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary w-full py-8 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-theme-border hover:border-curi-pink/40"
            >
              {isVideo ? <Film size={28} className="text-curi-pink" /> : <ImageIcon size={28} className="text-curi-pink" />}
              <span className="text-xs font-bold text-theme-text">
                {isVideo ? 'Choose video file' : 'Choose image file'}
              </span>
              <span className="text-[10px] text-theme-muted/50">
                {isVideo ? 'MP4, WebM, MOV · max 50 MB' : 'JPG, PNG, WebP · max 10 MB'}
              </span>
            </button>
          ) : (
            <div className="card p-3 border border-curi-pink/20">
              <div className="aspect-video rounded-lg overflow-hidden bg-theme-subtle/5 mb-3 border border-theme-border">
                {pendingUpload.type === 'video' ? (
                  <video
                    src={pendingUpload.url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    controls
                  />
                ) : (
                  <img
                    src={pendingUpload.url}
                    alt={pendingUpload.name}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <p className="text-[10px] text-theme-muted/55 truncate mb-2">{pendingUpload.name}</p>
              {pendingUpload.type === 'video' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applyUpload()}
                    className="col-span-2 py-2 rounded-lg bg-curi-pink text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Film size={14} /> Use as video background
                  </button>
                  <button type="button" onClick={clearPending} className="btn-secondary text-xs py-2">
                    Cancel
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-2">
                    Different file
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applyUpload('background')}
                    className="py-2 rounded-lg bg-curi-pink text-white text-[10px] font-bold flex flex-col items-center gap-1"
                  >
                    <Layout size={14} />
                    Background
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUpload('layer')}
                    className="py-2 rounded-lg bg-curi-blue text-white text-[10px] font-bold flex flex-col items-center gap-1"
                  >
                    <Layers size={14} />
                    Layer
                  </button>
                  <button type="button" onClick={clearPending} className="btn-secondary text-xs py-2">
                    Cancel
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-2">
                    Different file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
