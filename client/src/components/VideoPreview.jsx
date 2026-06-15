import { Star } from 'lucide-react'

export default function VideoPreview({ video, onFavorite, compact = false }) {
  if (compact) {
    return (
      <div className="rounded-xl overflow-hidden border border-theme-subtle/10 bg-theme-subtle/5">
        <div className="bg-gradient-to-br from-curi-navy to-curi-blue p-3 min-h-[72px] flex flex-col justify-end">
          <span className="badge bg-white/15 text-white text-[10px] mb-1 w-fit">{video.videoType?.replace(/_/g, ' ') || 'Video'}</span>
          <p className="text-white font-bold text-xs leading-snug line-clamp-2">"{video.hook}"</p>
        </div>
        {video.creativeScore?.overall && (
          <div className="px-2 py-1.5 text-[10px] text-curi-green font-semibold">Score {video.creativeScore.overall}</div>
        )}
      </div>
    )
  }

  return (
    <div className="card overflow-hidden hover:scale-[1.02] transition-all">
      <div className="bg-gradient-to-br from-curi-navy to-curi-blue p-5 min-h-[140px] flex flex-col justify-between">
        <div className="flex justify-between">
          <span className="badge bg-white/15 text-white text-xs">{video.videoType?.replace(/_/g, ' ')}</span>
          <button
            type="button"
            onClick={() => onFavorite?.(video)}
            className={video.favorited ? 'text-curi-yellow' : 'text-white/50 hover:text-white'}
          >
            <Star size={18} fill={video.favorited ? 'currentColor' : 'none'} />
          </button>
        </div>
        <p className="text-white font-bold text-sm leading-snug line-clamp-3">"{video.hook}"</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="font-bold text-theme-text">{video.title}</div>
        <div className="space-y-1.5">
          {(video.scenes || []).slice(0, 4).map((scene, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-curi-pink font-bold w-16 flex-shrink-0">{scene.label}</span>
              <span className="text-theme-muted/60 line-clamp-1">{scene.script}</span>
            </div>
          ))}
        </div>
        {video.scores && (
          <div className="flex gap-2 pt-2">
            <span className="badge bg-curi-green/15 text-curi-green">Score {video.scores.overall ?? video.creativeScore?.overall}</span>
            <span className="badge bg-theme-subtle/10 text-theme-muted/50">{video.voice}</span>
          </div>
        )}
      </div>
    </div>
  )
}
