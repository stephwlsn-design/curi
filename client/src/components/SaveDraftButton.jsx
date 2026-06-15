import { Save } from 'lucide-react'
import { useDraft } from '../context/DraftContext'

export default function SaveDraftButton({ className = '', compact = false }) {
  const { saveDraft, saving, activeDraftId } = useDraft()

  return (
    <button
      type="button"
      onClick={() => saveDraft()}
      disabled={saving}
      className={`inline-flex items-center gap-1.5 font-bold transition-all disabled:opacity-50 ${
        compact
          ? 'text-xs text-theme-muted/50 hover:text-curi-pink px-2 py-1'
          : 'btn-secondary text-sm py-2 px-4'
      } ${className}`}
      title="Save all Curi progress as a draft"
    >
      <Save size={compact ? 14 : 16} />
      {saving ? 'Saving...' : activeDraftId ? 'Update Draft' : 'Save Draft'}
    </button>
  )
}
