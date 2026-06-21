import { useNavigate } from 'react-router-dom'
import DesignPreview from '../DesignPreview'
import { LayoutTemplate } from 'lucide-react'

export default function DesignLibraryGrid({ designs, emptyMessage, onFavorite }) {
  const navigate = useNavigate()

  if (!designs.length) {
    return (
      <div className="page-card py-12 text-center">
        <LayoutTemplate size={40} className="mx-auto text-theme-muted/20 mb-4" />
        <p className="text-theme-muted/60 text-sm">{emptyMessage || 'No saved designs yet.'}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {designs.map((design) => (
        <DesignPreview
          key={design._id}
          design={design}
          compact
          onFavorite={onFavorite}
          onEdit={(d) => navigate(`/design/studio/${d._id}`)}
        />
      ))}
    </div>
  )
}
