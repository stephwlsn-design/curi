import { useState } from 'react'
import { Loader2, RefreshCw, LayoutTemplate, FolderOpen } from 'lucide-react'
import DesignPreview from './DesignPreview'
import DesignCanvasRenderer from './DesignCanvasRenderer'
import { useBrandAssets } from '../hooks/useBrandAssets'

const TABS = [
  { id: 'designs', label: 'Designs' },
  { id: 'templates', label: 'Templates' },
]

export default function DesignSavedPanel({
  workspaceId,
  embedded = false,
  onOpenDesign,
  onUseTemplate,
}) {
  const [tab, setTab] = useState('designs')
  const { designs, templates, loading, error, reload } = useBrandAssets(workspaceId)

  const emptyDesigns = !designs.length
  const emptyTemplates = !templates.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 p-0.5 rounded-lg bg-theme-subtle/5 border border-theme-border">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                tab === id
                  ? 'bg-curi-pink/15 text-curi-pink'
                  : 'text-theme-muted/60 hover:text-theme-text'
              }`}
            >
              {label}
              <span className="ml-1 opacity-60">
                {id === 'designs' ? designs.length : templates.length}
              </span>
            </button>
          ))}
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
        Your saved designs and custom templates from this workspace.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-theme-muted/50">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : error ? (
        <div className="card p-4 text-center">
          <p className="text-xs text-red-400 mb-2">{error}</p>
          <button type="button" onClick={reload} className="btn-secondary text-xs">Retry</button>
        </div>
      ) : tab === 'designs' ? (
        emptyDesigns ? (
          <div className="card p-6 text-center">
            <FolderOpen size={28} className="mx-auto text-theme-muted/25 mb-2" />
            <p className="text-xs text-theme-muted/55">No saved designs yet. Finish a design and click Save Design.</p>
          </div>
        ) : (
          <div className={`grid gap-3 ${embedded ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {designs.map((design) => (
              <DesignPreview
                key={design._id}
                design={design}
                compact
                onEdit={(d) => onOpenDesign?.(d)}
              />
            ))}
          </div>
        )
      ) : emptyTemplates ? (
        <div className="card p-6 text-center">
          <LayoutTemplate size={28} className="mx-auto text-theme-muted/25 mb-2" />
          <p className="text-xs text-theme-muted/55">No saved templates yet. Use Save as Template on the canvas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => {
            const canvas = template.canvasLayout
            const scale = canvas
              ? Math.min(120 / canvas.width, 120 / canvas.height, 0.22)
              : 0.2
            return (
              <button
                key={template._id}
                type="button"
                onClick={() => onUseTemplate?.(template)}
                className="w-full card p-2 flex items-center gap-3 text-left hover:border-curi-pink/30 transition-all"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-theme-subtle/5 flex-shrink-0 flex items-center justify-center">
                  {canvas ? (
                    <DesignCanvasRenderer canvas={canvas} scale={scale} />
                  ) : (
                    <LayoutTemplate size={20} className="text-theme-muted/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-theme-text truncate">{template.name}</div>
                  <div className="text-[10px] text-theme-muted/45 mt-0.5">
                    {template.dimensionId || '1080×1080'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
