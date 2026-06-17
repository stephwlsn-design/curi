import { useCallback, useEffect, useState } from 'react'
import { Image, Film, Search, Loader2 } from 'lucide-react'
import { API } from '../context/AuthContext'
import toast from 'react-hot-toast'

const QUICK_SEARCHES = {
  photos: ['business', 'office', 'marketing', 'nature', 'team', 'technology', 'food', 'fashion'],
  videos: ['business', 'office', 'nature', 'city', 'technology', 'people', 'abstract', 'workspace'],
}

export default function PexelsMediaPanel({
  workspaceId,
  onPhotoSelect,
  onVideoSelect,
  compact = false,
  embedded = false,
  defaultTab = 'photos',
  fixedTab,
  externalSearch,
}) {
  const [tab, setTab] = useState(fixedTab || defaultTab)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (fixedTab) setTab(fixedTab)
    else setTab(defaultTab)
  }, [defaultTab, fixedTab])

  useEffect(() => {
    if (externalSearch !== undefined && externalSearch !== searchInput) {
      setSearchInput(externalSearch)
    }
  }, [externalSearch])

  const fetchMedia = useCallback(async (mediaTab, q, pageNum, append = false) => {
    setLoading(true)
    try {
      const endpoint = mediaTab === 'videos' ? '/design/media/videos' : '/design/media/photos'
      const { data } = await API.get(endpoint, {
        params: { query: q || undefined, page: pageNum, perPage: compact ? 12 : 24 },
      })
      setItems((prev) => (append ? [...prev, ...data.items] : data.items))
      setHasMore(Boolean(data.nextPage))
      setPage(pageNum)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load Pexels media')
      if (!append) setItems([])
    } finally {
      setLoading(false)
    }
  }, [compact])

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    fetchMedia(tab, query, 1, false)
  }, [tab, query, fetchMedia])

  const loadMore = () => {
    if (!loading && hasMore) fetchMedia(tab, query, page + 1, true)
  }

  const handlePhoto = (item, useAs) => {
    onPhotoSelect?.(item, useAs)
  }

  return (
    <div className={embedded ? '' : `card ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
      {!embedded && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="text-lg font-bold text-theme-text">Stock Photos & Videos</div>
          <p className="text-sm text-theme-muted/60 mt-0.5">
            Free assets from Pexels — use as backgrounds or layers in your designs
          </p>
        </div>
        <div className="flex rounded-lg border border-theme-border p-0.5 bg-theme-subtle/5">
          <button
            type="button"
            onClick={() => setTab('photos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              tab === 'photos' ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
            }`}
          >
            <Image size={14} /> Photos
          </button>
          <button
            type="button"
            onClick={() => setTab('videos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              tab === 'videos' ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
            }`}
          >
            <Film size={14} /> Videos
          </button>
        </div>
      </div>
      )}

      {embedded && !fixedTab && (
        <div className="flex rounded-lg border border-theme-border p-0.5 bg-theme-subtle/5 mb-3">
          <button
            type="button"
            onClick={() => setTab('photos')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold ${
              tab === 'photos' ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
            }`}
          >
            <Image size={12} /> Photos
          </button>
          <button
            type="button"
            onClick={() => setTab('videos')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold ${
              tab === 'videos' ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
            }`}
          >
            <Film size={12} /> Videos
          </button>
        </div>
      )}

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted/40" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={tab === 'videos' ? 'Search stock videos…' : 'Search stock photos…'}
          className="input w-full pl-9 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {QUICK_SEARCHES[tab].map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => setSearchInput(term)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text hover:bg-theme-subtle/10 capitalize"
          >
            {term}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-theme-muted/50 gap-2">
          <Loader2 size={20} className="animate-spin" />
          Loading from Pexels…
        </div>
      ) : (
        <>
          <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'} max-h-[420px] overflow-y-auto pr-1`}>
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="group relative aspect-square rounded-lg overflow-hidden border border-theme-border bg-theme-subtle/5">
                <img
                  src={item.thumbnailUrl}
                  alt={item.alt || item.photographer || 'Pexels'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {item.type === 'video' && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold flex items-center gap-1">
                    <Film size={10} /> {item.duration}s
                  </span>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                  {item.type === 'photo' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePhoto(item, 'background')}
                        className="w-full py-1.5 px-2 rounded-md bg-white text-[10px] font-bold text-theme-text hover:bg-curi-pink hover:text-white transition-colors"
                      >
                        Use as Background
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhoto(item, 'layer')}
                        className="w-full py-1.5 px-2 rounded-md bg-white/90 text-[10px] font-bold text-theme-text hover:bg-curi-blue hover:text-white transition-colors"
                      >
                        Add as Layer
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onVideoSelect?.(item)}
                      className="w-full py-1.5 px-2 rounded-md bg-white text-[10px] font-bold text-theme-text hover:bg-curi-pink hover:text-white transition-colors"
                    >
                      Use Video
                    </button>
                  )}
                </div>
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[9px] text-white/80 truncate">{item.photographer}</p>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="btn-secondary w-full mt-3 text-sm"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      <p className="text-[10px] text-theme-muted/40 mt-3 text-center">
        Photos and videos provided by{' '}
        <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline hover:text-curi-pink">
          Pexels
        </a>
      </p>
    </div>
  )
}
