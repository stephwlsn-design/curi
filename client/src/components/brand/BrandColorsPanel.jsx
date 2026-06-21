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
    <div className="page-card mb-4 py-3 px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Palette size={14} className="text-curi-pink" />
          <h3 className="text-sm font-bold text-theme-text">Brand colors</h3>
        </div>
        <p className="text-[10px] text-theme-muted/45">
          Most used first · click to copy
        </p>
      </div>

      {Object.values(summary.named).some(Boolean) && (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-theme-border/50">
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
              className="flex items-center gap-1.5 text-left group"
              title={`Copy ${hex}`}
            >
              <div className="w-6 h-6 rounded-md border border-theme-border" style={{ backgroundColor: hex }} />
              <div>
                <div className="text-[9px] uppercase tracking-wide text-theme-muted/45 font-bold leading-none">{label}</div>
                <div className="text-[10px] font-mono text-theme-text group-hover:text-curi-pink leading-tight">{hex}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5">
        {summary.ranked.slice(0, 12).map(({ hex, total, source }) => (
          <button
            key={hex}
            type="button"
            onClick={() => copyHex(hex)}
            className="p-1.5 rounded-lg bg-theme-subtle/5 border border-theme-border/60 hover:border-curi-pink/40 transition-all text-left group"
          >
            <div className="w-full h-7 rounded-md border border-theme-border mb-1" style={{ backgroundColor: hex }} />
            <div className="font-mono text-[10px] leading-tight text-theme-text group-hover:text-curi-pink truncate">{hex}</div>
            <div className="text-[9px] text-theme-muted/45 leading-tight capitalize truncate">
              {source === 'brand' ? 'Brand' : source === 'designs' ? 'Designs' : 'Both'}
              {total > 1 ? ` · ${total}×` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
