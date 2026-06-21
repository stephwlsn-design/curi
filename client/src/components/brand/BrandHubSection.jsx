import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandColorsPanel from './BrandColorsPanel'
import {
  Loader2, RefreshCw, Sparkles, LayoutTemplate, FileText, Film, FolderOpen,
} from 'lucide-react'
import { useBrandAssets } from '../../hooks/useBrandAssets'
import DesignLibraryGrid from './DesignLibraryGrid'
import TemplateLibraryGrid from './TemplateLibraryGrid'
import ContentLibraryGrid from './ContentLibraryGrid'
import VideoLibraryGrid from './VideoLibraryGrid'
import DraftLibraryGrid from './DraftLibraryGrid'

const TABS = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'designs', label: 'Designs', icon: LayoutTemplate },
  { id: 'templates', label: 'Templates', icon: FolderOpen },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'videos', label: 'Videos', icon: Film },
  { id: 'drafts', label: 'Drafts', icon: FileText },
]

export default function BrandHubSection({ workspaceId }) {
  const navigate = useNavigate()
  const { workspace } = useAuth()
  const [tab, setTab] = useState('all')
  const { designs, templates, content, videos, drafts, loading, error, reload, counts } = useBrandAssets(workspaceId)

  const tabCounts = useMemo(() => ({
    all: counts.all,
    designs: counts.designs,
    templates: counts.templates,
    content: counts.content,
    videos: counts.videos,
    drafts: counts.drafts,
  }), [counts])

  const renderBody = () => {
    if (tab === 'designs') return <DesignLibraryGrid designs={designs} />
    if (tab === 'templates') return <TemplateLibraryGrid templates={templates} />
    if (tab === 'content') return <ContentLibraryGrid items={content} />
    if (tab === 'videos') return <VideoLibraryGrid videos={videos} />
    if (tab === 'drafts') return <DraftLibraryGrid drafts={drafts} onReload={reload} />

    return (
      <div className="space-y-10">
        {designs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-theme-text">Designs</h3>
              <button type="button" onClick={() => setTab('designs')} className="text-xs font-bold text-curi-pink hover:underline">
                View all ({designs.length})
              </button>
            </div>
            <DesignLibraryGrid designs={designs.slice(0, 4)} />
          </section>
        )}
        {templates.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-theme-text">Templates</h3>
              <button type="button" onClick={() => setTab('templates')} className="text-xs font-bold text-curi-pink hover:underline">
                View all ({templates.length})
              </button>
            </div>
            <TemplateLibraryGrid templates={templates.slice(0, 4)} />
          </section>
        )}
        {content.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-theme-text">Content</h3>
              <button type="button" onClick={() => setTab('content')} className="text-xs font-bold text-curi-pink hover:underline">
                View all ({content.length})
              </button>
            </div>
            <ContentLibraryGrid items={content.slice(0, 4)} />
          </section>
        )}
        {videos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-theme-text">Videos</h3>
              <button type="button" onClick={() => setTab('videos')} className="text-xs font-bold text-curi-pink hover:underline">
                View all ({videos.length})
              </button>
            </div>
            <VideoLibraryGrid videos={videos.slice(0, 3)} />
          </section>
        )}
        {drafts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-theme-text">Workflow drafts</h3>
              <button type="button" onClick={() => setTab('drafts')} className="text-xs font-bold text-curi-pink hover:underline">
                View all ({drafts.length})
              </button>
            </div>
            <DraftLibraryGrid drafts={drafts.slice(0, 4)} onReload={reload} />
          </section>
        )}
        {!designs.length && !templates.length && !content.length && !videos.length && !drafts.length && (
          <div className="page-card py-12 text-center">
            <Sparkles size={40} className="mx-auto text-theme-muted/20 mb-4" />
            <p className="text-theme-muted/60 text-sm mb-2">Your brand hub is empty</p>
            <p className="text-xs text-theme-muted/45 max-w-md mx-auto mb-5">
              Create designs, content, and videos across Curi — everything you save will show up here.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => navigate('/discover')} className="btn-primary text-sm">Start with Discover</button>
              <button type="button" onClick={() => navigate('/design/studio')} className="btn-secondary text-sm">Open Design Studio</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <BrandColorsPanel brandProfile={workspace?.brandProfile} designs={designs} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                tab === id
                  ? 'bg-curi-pink/15 text-curi-pink border border-curi-pink/30'
                  : 'bg-theme-subtle/5 text-theme-muted/60 border border-transparent hover:border-theme-border'
              }`}
            >
              <Icon size={14} />
              {label}
              <span className="text-xs font-mono opacity-70">{tabCounts[id]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={reload} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" onClick={() => navigate('/design/studio')} className="btn-primary text-sm">
            New design
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-theme-muted/50">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm">Loading brand assets…</span>
        </div>
      ) : error ? (
        <div className="page-card py-10 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button type="button" onClick={reload} className="btn-secondary text-sm">Try again</button>
        </div>
      ) : renderBody()}
    </div>
  )
}
