import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandColorsPanel from './BrandColorsPanel'
import {
  Loader2, RefreshCw, Sparkles, LayoutTemplate, FileText, Film, FolderOpen, Share2,
} from 'lucide-react'
import { useBrandAssets } from '../../hooks/useBrandAssets'
import DesignLibraryGrid from './DesignLibraryGrid'
import TemplateLibraryGrid from './TemplateLibraryGrid'
import ContentLibraryGrid from './ContentLibraryGrid'
import VideoLibraryGrid from './VideoLibraryGrid'
import DraftLibraryGrid from './DraftLibraryGrid'

const ASSET_TABS = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'designs', label: 'Designs', icon: LayoutTemplate },
  { id: 'templates', label: 'Templates', icon: FolderOpen },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'videos', label: 'Videos', icon: Film },
  { id: 'drafts', label: 'Drafts', icon: FileText },
]

export default function BrandHubSection({ workspaceId, initialTab = 'all' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { workspace } = useAuth()
  const [tab, setTab] = useState(initialTab)
  const { designs, templates, content, videos, drafts, loading, error, reload, counts } = useBrandAssets(workspaceId)

  useEffect(() => {
    if (location.hash === '#brand-hub-channels') {
      navigate('/channels', { replace: true })
      return
    }
    setTab(initialTab || 'all')
  }, [initialTab, location.hash, navigate])

  const selectTab = (id) => {
    setTab(id)
    navigate('/dashboard#brand-hub', { replace: true })
  }

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
              <button type="button" onClick={() => selectTab('designs')} className="text-xs font-bold text-curi-pink hover:underline">
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
              <button type="button" onClick={() => selectTab('templates')} className="text-xs font-bold text-curi-pink hover:underline">
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
              <button type="button" onClick={() => selectTab('content')} className="text-xs font-bold text-curi-pink hover:underline">
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
              <button type="button" onClick={() => selectTab('videos')} className="text-xs font-bold text-curi-pink hover:underline">
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
              <button type="button" onClick={() => selectTab('drafts')} className="text-xs font-bold text-curi-pink hover:underline">
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

      <button
        type="button"
        onClick={() => navigate('/channels')}
        className="w-full mb-4 p-4 rounded-2xl border text-left transition-all flex items-center gap-4 border-theme-subtle/10 bg-theme-subtle/5 hover:border-curi-blue/30 hover:bg-curi-blue/5"
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-curi-blue/15 text-curi-blue">
          <Share2 size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-theme-text">Social channels</div>
          <p className="text-sm text-theme-muted/55 mt-0.5">
            Connect accounts, view engagement stats, and publish via Curi Launch
          </p>
        </div>
        <span className="badge shrink-0 bg-theme-subtle/10 text-theme-muted/60">Open</span>
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {ASSET_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
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
