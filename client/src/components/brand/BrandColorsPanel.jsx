import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Palette } from 'lucide-react'
import toast from 'react-hot-toast'
import { buildBrandColorSummary } from '../../utils/brandColors'

const copyHex = (hex) => {
  navigator.clipboard.writeText(hex)
  toast.success(`Copied ${hex}`)
}

export default function BrandColorsPanel({ brandProfile, designs = [] }) {
  const navigate = useNavigate()
  const summary = useMemo(
    () => buildBrandColorSummary({ brandProfile, designs }),
    [brandProfile, designs],
  )

  if (!summary.hasColors) {
    return (
      <div className="page-card mb-6 border-dashed border-theme-border/80">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette size={16} className="text-curi-pink" />
              <h3 className="text-base font-bold text-theme-text">Brand colors</h3>
            </div>
            <p className="text-sm text-theme-muted/55 max-w-xl">
              Run Discover to extract your website palette, or save designs — Curi tracks the hex codes you use most.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/discover')} className="btn-primary text-sm">
            Run Discover
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-card mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette size={16} className="text-curi-pink" />
            <h3 className="text-base font-bold text-theme-text">Brand colors</h3>
          </div>
          <p className="text-xs text-theme-muted/50">
            Ordered by how often each color appears in your brand profile and saved designs (most used first).
          </p>
        </div>
      </div>

      {Object.values(summary.named).some(Boolean) && (
        <div className="flex flex-wrap gap-3 mb-5 pb-5 border-b border-theme-border/50">
          {[
            ['Primary', summary.named.primary],
            ['Secondary', summary.named.secondary],
            ['Accent', summary.named.accent],
            ['Background', summary.named.background],
            ['Text', summary.named.text],
          ].filter(([, hex]) => hex).map(([label, hex]) => (
            <button
              key={label}
              type="button"
              onClick={() => copyHex(hex)}
              className="flex items-center gap-2 text-left group"
              title={`Copy ${hex}`}
            >
              <div className="w-9 h-9 rounded-lg border border-theme-border shadow-sm" style={{ backgroundColor: hex }} />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-theme-muted/45 font-bold">{label}</div>
                <div className="text-xs font-mono text-theme-text group-hover:text-curi-pink">{hex}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {summary.ranked.slice(0, 12).map(({ hex, total, source }) => (
          <button
            key={hex}
            type="button"
            onClick={() => copyHex(hex)}
            className="p-3 rounded-xl bg-theme-subtle/5 border border-theme-border/60 hover:border-curi-pink/40 transition-all text-left group"
          >
            <div className="w-full aspect-square rounded-lg border border-theme-border mb-2" style={{ backgroundColor: hex }} />
            <div className="font-mono text-xs text-theme-text group-hover:text-curi-pink">{hex}</div>
            <div className="text-[10px] text-theme-muted/45 mt-0.5 capitalize">
              {source === 'brand' ? 'Brand site' : source === 'designs' ? 'Your designs' : 'Brand + designs'}
              {total > 1 ? ` · ${total}×` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
