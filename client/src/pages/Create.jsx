import { useState, useEffect } from 'react'
import { API } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingMascot from '../components/LoadingMascot'

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', color: 'bg-blue-600/20 text-blue-400 border-blue-600/30', maxChars: 3000 },
  { id: 'twitter', label: 'X / Twitter', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', maxChars: 280 },
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', maxChars: 2200 },
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', maxChars: 63206 },
  { id: 'tiktok', label: 'TikTok', color: 'bg-theme-subtle/10 text-theme-text border-theme-border', maxChars: 2200 },
  { id: 'universal', label: 'Universal', color: 'bg-curi-green/20 text-curi-green border-curi-green/30', maxChars: 500 },
]

const platformLimit = (platformId) =>
  PLATFORMS.find((p) => p.id === platformId)?.maxChars ?? 500

const normalizeTag = (tag) => tag.replace(/^#+/, '').trim()

const TONES = ['professional', 'casual', 'witty', 'bold']
const TYPES = [
  { id: 'social_post', label: 'Social Post' },
  { id: 'ad_copy', label: 'Ad Copy' },
  { id: 'product_description', label: 'Product Description' },
  { id: 'landing_page_copy', label: 'Landing Page Copy' },
]

export default function Create() {
  const { workspaceId, fetchMe } = useAuth()
  const { workflow, setContent } = useCoreWorkflow()
  const [platform, setPlatform] = useState('linkedin')
  const [tone, setTone] = useState('professional')
  const [type, setType] = useState('social_post')
  const [topic, setTopic] = useState(workflow.topic || '')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [editedContent, setEditedContent] = useState('')
  const [editedHashtags, setEditedHashtags] = useState([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [charLimit, setCharLimit] = useState(platformLimit('linkedin'))
  const [saved, setSaved] = useState(workflow.createSaved)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState([])

  useDraftModule('create', () => ({
    platform, tone, type, topic, editedContent, editedHashtags, result, saved, history,
  }), (s) => {
    if (s.platform) setPlatform(s.platform)
    if (s.tone) setTone(s.tone)
    if (s.type) setType(s.type)
    if (s.topic) setTopic(s.topic)
    if (s.editedContent) setEditedContent(s.editedContent)
    if (s.editedHashtags) setEditedHashtags(s.editedHashtags)
    if (s.result) setResult(s.result)
    if (s.saved != null) setSaved(s.saved)
    if (s.history) setHistory(s.history)
  })

  useEffect(() => {
    if (workflow.topic && !topic) setTopic(workflow.topic)
  }, [workflow.topic])

  useEffect(() => {
    if (result) {
      setEditedContent(result.content || '')
      setEditedHashtags(result.hashtags || [])
    }
  }, [result])

  useEffect(() => {
    setCharLimit(platformLimit(platform))
  }, [platform])

  const generate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic first')
    if (!workspaceId) return toast.error('Workspace not loaded — please sign out and sign in again')
    setLoading(true)
    setSaved(false)
    try {
      const { data } = await API.post('/create/post', {
        workspaceId, platform, tone, type, topic: topic.trim(),
      }, { timeout: 55000 })

      const contentDoc = data?.content
      if (!contentDoc?.content?.trim()) {
        return toast.error('No content returned — try again with a more specific topic')
      }

      setResult(contentDoc)
      setEditedContent(contentDoc.content)
      setEditedHashtags(contentDoc.hashtags || [])
      setSaved(true)
      setContent({
        contentId: contentDoc._id,
        contentText: contentDoc.content,
        topic,
        saved: true,
      })
      setHistory(h => [contentDoc, ...h.slice(0, 4)])
      toast.success('Content generated and saved!')
      fetchMe?.()
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.response?.status === 402 ? 'Not enough credits — you need 1 credit to generate' : null)
        || (err.code === 'ECONNABORTED' ? 'Generation timed out — try again' : null)
        || (err.code === 'ERR_NETWORK' ? 'Cannot reach server — check your connection' : null)
        || 'Generation failed'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const save = async (asDraft = false) => {
    if (!result?._id) return toast.error('Generate content first')
    setSaving(true)
    try {
      const { data } = await API.patch(`/create/${result._id}`, {
        workspaceId,
        content: editedContent,
        hashtags: editedHashtags,
        status: asDraft ? 'draft' : 'approved',
      })
      setResult(data.content)
      setEditedHashtags(data.content.hashtags || editedHashtags)
      setSaved(true)
      setContent({
        contentId: data.content._id,
        contentText: editedContent,
        topic,
        saved: !asDraft,
      })
      toast.success(asDraft ? 'Saved as draft' : 'Content saved!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const schedule = async () => {
    if (!result?._id) return toast.error('Generate content first')
    if (!saved) await save()
    const scheduledAt = new Date()
    scheduledAt.setDate(scheduledAt.getDate() + 1)
    scheduledAt.setHours(9, 0, 0, 0)
    try {
      await API.post('/publish/schedule', {
        contentId: result._id,
        scheduledAt: scheduledAt.toISOString(),
        platform,
      })
      toast.success('Scheduled for tomorrow at 9 AM')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Schedule failed')
    }
  }

  const copy = () => {
    const tags = editedHashtags.map((h) => `#${normalizeTag(h)}`).join(' ')
    const text = tags ? `${editedContent}\n\n${tags}` : editedContent
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied post and hashtags!')
  }

  const copyHashtags = () => {
    if (!editedHashtags.length) return toast.error('No hashtags to copy')
    navigator.clipboard.writeText(editedHashtags.map((h) => `#${normalizeTag(h)}`).join(' '))
    toast.success('Hashtags copied!')
  }

  const addHashtag = () => {
    const tag = normalizeTag(hashtagInput)
    if (!tag) return
    if (editedHashtags.some((h) => normalizeTag(h).toLowerCase() === tag.toLowerCase())) {
      setHashtagInput('')
      return
    }
    setEditedHashtags((prev) => [...prev, tag])
    setHashtagInput('')
    setSaved(false)
  }

  const removeHashtag = (index) => {
    setEditedHashtags((prev) => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  const charCount = editedContent.length
  const charRemaining = charLimit - charCount
  const charPct = charLimit > 0 ? Math.min(100, (charCount / charLimit) * 100) : 0
  const isOverLimit = charCount > charLimit
  const isNearLimit = !isOverLimit && charPct >= 85

  const handleBeforeNext = async () => {
    if (!result) {
      toast.error('Generate content before continuing')
      return false
    }
    if (!saved || editedContent !== result.content || JSON.stringify(editedHashtags) !== JSON.stringify(result.hashtags || [])) {
      try {
        await API.patch(`/create/${result._id}`, {
          workspaceId,
          content: editedContent,
          hashtags: editedHashtags,
          status: 'approved',
        })
        setContent({ contentId: result._id, contentText: editedContent, topic, saved: true })
        setSaved(true)
      } catch {
        toast.error('Save failed — fix errors before continuing')
        return false
      }
    }
    return true
  }

  return (
    <PageShell>
      <CoreWorkflowNav
        stepId="create"
        canProceed={!!result}
        onBeforeNext={handleBeforeNext}
      />

      <PageHeader
        title="Curi Create"
        description="Generate platform-native content in your brand voice. One click."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <div className="page-card">
          <div className="section-label mb-3">Platform</div>
          <div className="space-y-2">
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-base font-medium transition-all ${platform === p.id ? p.color : 'border-transparent text-theme-muted/60 hover:text-theme-text hover:bg-theme-subtle/5'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="page-card">
          <div className="section-label mb-3">Tone</div>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map(t => (
              <button key={t} onClick={() => setTone(t)}
                className={`py-2.5 rounded-lg text-base font-medium capitalize transition-all ${tone === t ? 'bg-curi-gradient text-white' : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="page-card">
          <div className="section-label mb-3">Content Type</div>
          <div className="space-y-1.5">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-base transition-all ${type === t.id ? 'bg-curi-pink/20 text-curi-pink' : 'text-theme-muted/60 hover:text-theme-text hover:bg-theme-subtle/5'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-card mb-6">
        <div className="section-label mb-3">Topic</div>
        <textarea
          className="input resize-none h-32 text-base"
          placeholder="E.g. our new product launch, a customer success story, a hot industry trend..."
          value={topic}
          onChange={e => setTopic(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-sm text-theme-muted/50 font-medium">Uses your brand voice from Discover</span>
          <button onClick={generate} disabled={loading} className="btn-primary text-base px-6 py-3">
            {loading ? 'Generating...' : 'Generate Content'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="page-card text-center py-12 mb-6">
          <LoadingMascot size="xl" className="mb-6" />
          <div className="text-theme-text font-semibold text-lg mb-1">Writing in your brand voice...</div>
          <div className="text-theme-muted/50 text-base">Crafting platform-native content with Gemini</div>
        </div>
      )}

      <AnimatePresence>
        {result && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-card mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-medium text-theme-text capitalize">{platform} Post</span>
                {saved && <span className="badge bg-curi-green/15 text-curi-green">Saved</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="btn-secondary text-sm py-2 px-4">
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={generate} className="btn-secondary text-sm py-2 px-4">Retry</button>
                <button onClick={() => save(true)} disabled={saving} className="btn-secondary text-sm py-2 px-4">
                  Save Draft
                </button>
                <button onClick={() => save(false)} disabled={saving} className="btn-primary text-sm py-2 px-4">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={schedule} className="btn-secondary text-sm py-2 px-4">Schedule</button>
              </div>
            </div>

            <textarea
              className="input resize-none min-h-[180px] text-base leading-relaxed"
              value={editedContent}
              onChange={e => { setEditedContent(e.target.value); setSaved(false) }}
            />

            <div className="mt-4 pt-4 border-t border-theme-border/60 space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <span className="section-label">Character count</span>
                  <div className="flex items-center gap-2 text-sm">
                    <label htmlFor="char-limit" className="text-theme-muted/50 font-medium">Limit</label>
                    <input
                      id="char-limit"
                      type="number"
                      min={50}
                      max={100000}
                      className="input w-24 py-1.5 text-sm text-center"
                      value={charLimit}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10)
                        if (!Number.isNaN(n) && n > 0) setCharLimit(n)
                      }}
                    />
                  </div>
                </div>
                <div className="h-3 bg-theme-subtle/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-curi-yellow' : 'bg-curi-gradient'
                    }`}
                    style={{ width: `${charPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs font-medium">
                  <span className={isOverLimit ? 'text-red-400' : 'text-theme-text'}>
                    {charCount.toLocaleString()} / {charLimit.toLocaleString()} characters
                  </span>
                  <span className={isOverLimit ? 'text-red-400' : charRemaining < 50 ? 'text-curi-yellow' : 'text-theme-muted/50'}>
                    {isOverLimit
                      ? `${Math.abs(charRemaining).toLocaleString()} over limit`
                      : `${charRemaining.toLocaleString()} remaining`}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="section-label">Post hashtags</span>
                  {editedHashtags.length > 0 && (
                    <button type="button" onClick={copyHashtags} className="text-xs font-semibold text-curi-blue hover:underline">
                      Copy hashtags
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
                  {editedHashtags.length === 0 ? (
                    <span className="text-sm text-theme-muted/40">No hashtags yet — add below or regenerate</span>
                  ) : (
                    editedHashtags.map((h, i) => (
                      <span
                        key={`${h}-${i}`}
                        className="badge bg-curi-blue/15 text-curi-blue inline-flex items-center gap-1 pr-1"
                      >
                        #{normalizeTag(h)}
                        <button
                          type="button"
                          onClick={() => removeHashtag(i)}
                          className="w-4 h-4 rounded-full hover:bg-curi-blue/20 text-curi-blue/70 hover:text-curi-blue leading-none"
                          aria-label={`Remove ${h}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1 py-2 text-sm"
                    placeholder="Add hashtag (e.g. marketing)"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addHashtag()
                      }
                    }}
                  />
                  <button type="button" onClick={addHashtag} className="btn-secondary text-sm py-2 px-4">
                    Add
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 1 && (
        <div>
          <div className="section-label mb-3">Previous Generations</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {history.slice(1).map((item, i) => (
              <button key={i} onClick={() => {
                setResult(item)
                setEditedContent(item.content || '')
                setEditedHashtags(item.hashtags || [])
                setSaved(true)
              }}
                className="page-card text-left hover:border-theme-border transition-all">
                <div className="text-theme-muted/60 text-sm line-clamp-3">{item.content}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  )
}
