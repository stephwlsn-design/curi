import { useState } from 'react'
import { API, useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const SOURCE_TYPES = ['blog', 'article', 'newsletter', 'video_script', 'podcast_transcript', 'product_page']

export default function Repurpose() {
  const { workspaceId } = useAuth()
  const [sourceType, setSourceType] = useState('blog')
  const [sourceContent, setSourceContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [formats, setFormats] = useState([])

  const generate = async () => {
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

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Repurpose</h1>
        <p className="text-theme-muted/50">Turn one piece of content into 10 platform-ready formats — tweets, posts, emails, video scripts, ads, and more.</p>
      </div>

      <div className="card p-5 mb-6">
        <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Source Type</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {SOURCE_TYPES.map(t => (
            <button key={t} onClick={() => setSourceType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${sourceType === t ? 'bg-curi-green/15 text-curi-green' : 'bg-theme-subtle/5 text-theme-muted/50'}`}>
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <textarea
          className="input resize-none h-40 text-base"
          placeholder="Paste your blog post, article, newsletter, or any long-form content..."
          value={sourceContent}
          onChange={e => setSourceContent(e.target.value)}
        />
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-theme-muted/40">5 credits</span>
          <button onClick={generate} disabled={loading} className="btn-primary">
            {loading ? 'Repurposing...' : 'Repurpose to 10 Formats'}
          </button>
        </div>
      </div>

      {formats.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {formats.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="badge bg-curi-blue/15 text-curi-blue capitalize">{f.type?.replace(/_/g, ' ')}</span>
                <button onClick={() => copy(f.content)} className="text-xs text-theme-muted/40 hover:text-curi-pink font-bold">Copy</button>
              </div>
              {f.title && <div className="font-bold text-theme-text text-sm mb-2">{f.title}</div>}
              <p className="text-theme-muted/60 text-sm whitespace-pre-wrap line-clamp-6">{f.content}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
