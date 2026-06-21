import { useNavigate } from 'react-router-dom'
import { FileText, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_LABELS = {
  post: 'Post',
  blog: 'Blog',
  image: 'Image',
  video: 'Video',
  email: 'Email',
}

export default function ContentLibraryGrid({ items, emptyMessage }) {
  const navigate = useNavigate()

  const copyText = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  if (!items.length) {
    return (
      <div className="page-card py-12 text-center">
        <FileText size={40} className="mx-auto text-theme-muted/20 mb-4" />
        <p className="text-theme-muted/60 text-sm">{emptyMessage || 'No saved content yet.'}</p>
        <button type="button" onClick={() => navigate('/create')} className="btn-secondary text-sm mt-4">
          Generate content in Curi Create
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item._id} className="page-card flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="badge bg-curi-pink/15 text-curi-pink text-[10px] capitalize">
                  {item.platform || 'universal'}
                </span>
                <span className="badge bg-theme-subtle/10 text-theme-muted/60 text-[10px]">
                  {TYPE_LABELS[item.type] || item.type}
                </span>
                {item.status && (
                  <span className="badge bg-theme-subtle/10 text-theme-muted/50 text-[10px] capitalize">
                    {item.status}
                  </span>
                )}
              </div>
              {item.title && (
                <div className="font-bold text-theme-text text-sm truncate">{item.title}</div>
              )}
              <div className="text-xs text-theme-muted/40 mt-1">
                {item.createdAt && new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyText(item.content || item.title || '')}
              className="p-2 rounded-lg hover:bg-theme-subtle/10 text-theme-muted/50 hover:text-curi-pink flex-shrink-0"
              title="Copy"
            >
              <Copy size={16} />
            </button>
          </div>
          <p className="text-sm text-theme-muted/70 leading-relaxed line-clamp-4 whitespace-pre-wrap">
            {item.content || item.title || '—'}
          </p>
          {item.hashtags?.length > 0 && (
            <p className="text-xs text-curi-blue truncate">
              {item.hashtags.map((t) => `#${String(t).replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
