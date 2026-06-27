import { useMemo, useEffect } from 'react'
import { Clock, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import DesignPreview from './DesignPreview'
import { useBrandAssets } from '../hooks/useBrandAssets'

const formatTimeAgo = (date) => {
  if (!date) return ''
  const ts = new Date(date).getTime()
  if (!Number.isFinite(ts)) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DesignRecentPanel({
  workspaceId,
  embedded = false,
  onOpenDesign,
  refreshToken = 0,
}) {
  const { designs, loading, error, reload } = useBrandAssets(workspaceId)

  useEffect(() => {
    if (refreshToken > 0) reload()
  }, [refreshToken, reload])

  const recent = useMemo(() => (
    [...designs]
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return bTs - aTs
      })
      .slice(0, 30)
  ), [designs])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-curi-pink" />
          <h3 className="text-sm font-bold text-theme-text">Recent designs</h3>
        </div>
        <button
          type="button"
          onClick={reload}
          className="p-1.5 rounded-lg text-theme-muted/50 hover:text-curi-pink hover:bg-curi-pink/5"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="text-[11px] text-theme-muted/55 leading-snug">
        Your latest work in this workspace — auto-saved as you edit on the canvas.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-theme-muted/50">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">Loading recent designs…</span>
        </div>
      ) : error ? (
        <div className="card p-4 text-center">
          <p className="text-xs text-red-400 mb-2">{error}</p>
          <button type="button" onClick={reload} className="btn-secondary text-xs">Retry</button>
        </div>
      ) : recent.length === 0 ? (
        <div className="card p-6 text-center">
          <Sparkles size={28} className="mx-auto text-theme-muted/25 mb-2" />
          <p className="text-xs text-theme-muted/55">
            No designs yet. Start from Inspire or Templates — your work saves automatically as you go.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${embedded ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {recent.map((design) => (
            <div key={design._id} className="space-y-1">
              <DesignPreview
                design={design}
                compact
                onEdit={(d) => onOpenDesign?.(d)}
              />
              <p className="text-[10px] text-theme-muted/45 px-1">
                {formatTimeAgo(design.updatedAt || design.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
