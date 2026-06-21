import { useNavigate } from 'react-router-dom'
import DesignCanvasRenderer from '../DesignCanvasRenderer'
import { LayoutTemplate } from 'lucide-react'

export default function TemplateLibraryGrid({ templates, emptyMessage }) {
  const navigate = useNavigate()

  if (!templates.length) {
    return (
      <div className="page-card py-12 text-center">
        <LayoutTemplate size={40} className="mx-auto text-theme-muted/20 mb-4" />
        <p className="text-theme-muted/60 text-sm">{emptyMessage || 'No saved templates yet.'}</p>
        <button
          type="button"
          onClick={() => navigate('/design/studio?step=2&panel=templates')}
          className="btn-secondary text-sm mt-4"
        >
          Create a template in Design Studio
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {templates.map((template) => {
        const canvas = template.canvasLayout
        const scale = canvas
          ? Math.min(280 / canvas.width, 280 / canvas.height, 0.35)
          : 0.3
        return (
          <div key={template._id} className="card overflow-hidden group hover:scale-[1.02] transition-all">
            <div className="aspect-square relative overflow-hidden bg-theme-subtle/5 flex items-center justify-center">
              {canvas ? (
                <DesignCanvasRenderer canvas={canvas} scale={scale} />
              ) : (
                <LayoutTemplate size={32} className="text-theme-muted/30" />
              )}
              <span className="absolute top-2 left-2 badge bg-curi-blue/80 text-white text-[10px]">Template</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="font-bold text-theme-text text-sm truncate">{template.name}</div>
                <div className="text-xs text-theme-muted/40 mt-0.5">
                  {template.dimensionId || '1080×1080'}
                  {template.createdAt && ` · ${new Date(template.createdAt).toLocaleDateString()}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/design/studio?step=2&panel=templates&userTemplate=${template._id}`)}
                className="btn-secondary w-full text-xs"
              >
                Use template
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
