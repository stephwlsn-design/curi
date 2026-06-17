import { useMemo, useState } from 'react'
import { Search, LayoutTemplate, Check } from 'lucide-react'
import DesignCanvasRenderer from './DesignCanvasRenderer'
import {
  GRAPHIC_TEMPLATE_CATEGORIES,
  searchGraphicTemplates,
  buildGraphicPreviewCanvas,
} from '../utils/graphicCanvas'

export default function DesignTemplateGallery({
  brandColors,
  selectedId,
  onSelect,
  userTemplates = [],
  onSelectUserTemplate,
}) {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => searchGraphicTemplates(search, category),
    [search, category],
  )

  return (
    <div className="card p-5 md:p-6">
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-theme-text">
              <LayoutTemplate size={20} className="text-curi-pink" />
              Templates
            </div>
            <p className="text-sm text-theme-muted/60 mt-1">
              Choose a ready-made graphic — hiring posts, quotes, promos, events, and more
            </p>
          </div>
          <span className="text-xs font-medium text-theme-muted/50 whitespace-nowrap">
            {filtered.length} templates · {userTemplates.length} saved
          </span>
        </div>

        <div className="relative max-w-xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted/40" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates — hiring, quotes, webinar…"
            className="input w-full pl-10 py-2.5 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {GRAPHIC_TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                category === cat.id
                  ? 'bg-curi-pink text-white'
                  : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text hover:bg-theme-subtle/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-theme-muted/50 text-sm">
          No templates match your search. Try &quot;hiring&quot;, &quot;quote&quot;, or &quot;webinar&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map(template => {
            const canvas = buildGraphicPreviewCanvas(template, brandColors)
            const scale = Math.min(1, 160 / canvas.width, 160 / canvas.height)
            const isSelected = selectedId === template.id

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template)}
                title={template.name}
                className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.03] hover:shadow-lg ${
                  isSelected
                    ? 'border-curi-pink ring-2 ring-curi-pink/30'
                    : 'border-theme-border hover:border-curi-pink/50'
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-theme-subtle/5">
                  <DesignCanvasRenderer canvas={canvas} scale={scale} />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-white text-[11px] font-bold leading-tight truncate">{template.name}</div>
                </div>
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 p-1 rounded-full bg-curi-pink text-white shadow">
                    <Check size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {userTemplates.length > 0 && (
        <div className="mt-6 pt-5 border-t border-theme-border">
          <div className="text-xs font-semibold text-theme-muted/50 uppercase tracking-wider mb-3">
            Your Saved Templates
          </div>
          <div className="flex flex-wrap gap-2">
            {userTemplates.map(t => (
              <button
                key={t._id}
                type="button"
                onClick={() => onSelectUserTemplate?.(t)}
                className="px-3 py-2 rounded-lg border border-curi-blue/25 hover:border-curi-blue/50 text-sm font-medium text-theme-text"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
