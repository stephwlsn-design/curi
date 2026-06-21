import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const SOURCE_TYPES = ['blog', 'article', 'newsletter', 'video_script', 'podcast_transcript', 'product_page']

export default function Repurpose() {
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [sourceType, setSourceType] = useState('blog')
  const [sourceContent, setSourceContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formats, setFormats] = useState([])

  const generate = async () => {
    if (!workspaceId) return toast.error('Select a workspace first')
    if (!sourceContent.trim()) return toast.error('Paste your source content first')
    setLoading(true)
    try {
      const { data } = await API.post('/repurpose/generate', { workspaceId, sourceContent, sourceType })
      setFormats(data.formats || [])
      toast.success(`Repurposed into ${data.formats?.length || 0} formats`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Repurpose failed')
    } finally { setLoading(false) }
  }

  const saveAll = async () => {
    if (!formats.length) return
    setSaving(true)
    try {
      const { data } = await API.post('/repurpose/save', { workspaceId, formats, sourceType })
      toast.success(data.message || 'Saved to content library')
      navigate('/dashboard#brand-hub')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  return (
    <PageShell>
      <PageHeader
        title="Curi Repurpose"
        description="Turn one piece of content into 10 platform-ready formats — tweets, posts, emails, video scripts, ads, and more."
      />

      <div className="page-card mb-6">
        <div className="section-label mb-3">Source Type</div>
        <div className="flex flex-wrap gap-2 mb-5">
          {SOURCE_TYPES.map(t => (
            <button key={t} onClick={() => setSourceType(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${sourceType === t ? 'bg-curi-green/15 text-curi-green' : 'bg-theme-subtle/5 text-theme-muted/60'}`}>
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="section-label mb-3">Source Content</div>
        <textarea
          className="input resize-none h-40 text-base"
          placeholder="Paste your blog post, article, newsletter, or any long-form content..."
          value={sourceContent}
          onChange={e => setSourceContent(e.target.value)}
        />
        <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
          <span className="text-sm text-theme-muted/50">5 credits</span>
          <button onClick={generate} disabled={loading || !workspaceId} className="btn-primary text-base px-6 py-3">
            {loading ? 'Repurposing...' : 'Repurpose to 10 Formats'}
          </button>
        </div>
      </div>

      {formats.length > 0 && (
        <>
          <div className="flex justify-end mb-4">
            <button type="button" onClick={saveAll} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving…' : 'Save all to Brand Hub →'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {formats.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="page-card">
                <div className="flex justify-between items-start mb-2">
                  <span className="badge bg-curi-blue/15 text-curi-blue capitalize">{f.type?.replace(/_/g, ' ')}</span>
                  <button onClick={() => copy(f.content)} className="text-sm text-theme-muted/50 hover:text-curi-pink font-bold">Copy</button>
                </div>
                {f.title && <div className="font-bold text-theme-text text-base mb-2">{f.title}</div>}
                <p className="text-theme-muted/60 text-sm whitespace-pre-wrap line-clamp-6">{f.content}</p>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}
