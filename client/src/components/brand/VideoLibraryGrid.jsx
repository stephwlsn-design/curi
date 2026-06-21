import { useNavigate } from 'react-router-dom'
import { Film } from 'lucide-react'

export default function VideoLibraryGrid({ videos, emptyMessage }) {
  const navigate = useNavigate()

  if (!videos.length) {
    return (
      <div className="page-card py-12 text-center">
        <Film size={40} className="mx-auto text-theme-muted/20 mb-4" />
        <p className="text-theme-muted/60 text-sm">{emptyMessage || 'No saved videos yet.'}</p>
        <button type="button" onClick={() => navigate('/video')} className="btn-secondary text-sm mt-4">
          Create videos in Curi Video
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <div key={video._id} className="page-card">
          <div className="flex items-center gap-2 mb-2">
            <Film size={16} className="text-curi-blue flex-shrink-0" />
            <span className="font-bold text-theme-text text-sm truncate">{video.title || 'Video'}</span>
          </div>
          <p className="text-sm text-theme-muted/60 line-clamp-3">{video.hook || video.content || video.script}</p>
          <div className="text-xs text-theme-muted/40 mt-2">
            {video.createdAt && new Date(video.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  )
}
