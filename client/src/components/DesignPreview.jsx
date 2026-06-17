import { Star, Pencil } from 'lucide-react'
import DesignCanvasRenderer from './DesignCanvasRenderer'
import { designToCanvas } from '../utils/designCanvas'

export default function DesignPreview({ design, onFavorite, onEdit, compact = false }) {
  const colors = design.colorPalette || ['#FF6B9D', '#4DA8EE', '#1A2B48']
  const bg = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`
  const isUploaded = design.mediaUrl || design.metadata?.source === 'user-upload' || design.source === 'user-upload'
  const isPexelsVideo = design.pexels?.mediaType === 'video' || design.metadata?.pexels?.mediaType === 'video'
  const isReferenceBased = design.canvasLayout?.designIdeaBased || design.canvasLayout?.background?.type === 'image' || design.referenceImageUrl
  const canvas = !isUploaded ? (design.canvasLayout || designToCanvas(design)) : null
  const previewScale = canvas ? (compact ? 0.26 : Math.min(300 / canvas.width, 300 / canvas.height)) : 1

  return (
    <div className="card overflow-hidden group hover:scale-[1.02] transition-all">
      <div className="aspect-square relative overflow-hidden bg-theme-subtle/5 flex items-center justify-center">
        {isUploaded ? (
          <img
            src={design.mediaUrl || design.thumbnailUrl}
            alt={design.name || design.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <DesignCanvasRenderer canvas={canvas} scale={previewScale} />
            </div>
            <div className="absolute inset-0 -z-10" style={{ background: bg }} />
          </>
        )}

        {isPexelsVideo && (
          <span className="absolute top-2 left-2 badge bg-curi-blue/80 text-white text-[10px] z-10 flex items-center gap-1">
            ▶ Video
          </span>
        )}
        {isReferenceBased && !isUploaded && !isPexelsVideo && (
          <span className="absolute top-2 left-2 badge bg-curi-pink/80 text-white text-[10px] z-10">From Reference</span>
        )}
        {isUploaded && (
          <span className="absolute top-2 left-2 badge bg-black/50 text-white text-[10px]">Uploaded</span>
        )}

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {onEdit && !isUploaded && (
            <button
              type="button"
              onClick={() => onEdit(design)}
              className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
              title="Edit on canvas"
            >
              <Pencil size={16} />
            </button>
          )}
          {onFavorite && (
            <button
              type="button"
              onClick={() => onFavorite(design)}
              className={`p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors ${design.favorited ? 'text-curi-yellow' : 'text-white'}`}
              title="Favorite"
            >
              <Star size={16} fill={design.favorited ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-theme-text text-sm">{design.name}</span>
          <span className="text-xs text-theme-muted/40 font-mono">
            {isUploaded ? 'Uploaded' : (design.dimensions?.label || `${canvas?.width}×${canvas?.height}`)}
          </span>
        </div>
        {!compact && design.scores && (
          <div className="grid grid-cols-4 gap-1 text-center">
            {[
              { k: 'Engagement', v: design.scores.engagement ?? design.scores.engagementPrediction },
              { k: 'Brand', v: design.scores.brand ?? design.scores.brandAlignment },
              { k: 'Convert', v: design.scores.conversion ?? design.scores.ctrPrediction },
              { k: 'Platform', v: design.scores.platform ?? design.scores.visualAppeal },
            ].filter(s => s.v != null).map(s => (
              <div key={s.k} className="bg-theme-subtle/5 rounded-lg py-1">
                <div className="text-xs font-bold text-curi-pink">{s.v}</div>
                <div className="text-[10px] text-theme-muted/40">{s.k}</div>
              </div>
            ))}
          </div>
        )}
        {onEdit && !isUploaded && (
          <button type="button" onClick={() => onEdit(design)} className="btn-secondary w-full text-xs mt-3">
            Edit on Canvas
          </button>
        )}
      </div>
    </div>
  )
}
