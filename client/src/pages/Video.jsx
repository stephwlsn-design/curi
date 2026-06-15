import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import VideoPreview from '../components/VideoPreview'
import { VIDEO_TYPES, VIDEO_STYLES, VOICES, VIDEO_VARIANT_COUNTS } from '../constants/creative'

export default function Video() {
  const { workspaceId, fetchMe } = useAuth()
  const { workflow } = useCoreWorkflow()
  const [prompt, setPrompt] = useState(workflow.contentText || '')
  const [videoType, setVideoType] = useState('motion_graphics')
  const [style, setStyle] = useState('Professional')
  const [voice, setVoice] = useState('Professional')
  const [variantCount, setVariantCount] = useState(5)
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(false)
  const [videos, setVideos] = useState([])
  const [selected, setSelected] = useState(null)

  useDraftModule('video', () => ({
    prompt, videoType, style, voice, variantCount, duration, videos, selectedId: selected?._id, selected,
  }), (s) => {
    if (s.prompt) setPrompt(s.prompt)
    if (s.videoType) setVideoType(s.videoType)
    if (s.style) setStyle(s.style)
    if (s.voice) setVoice(s.voice)
    if (s.variantCount) setVariantCount(s.variantCount)
    if (s.duration) setDuration(s.duration)
    if (s.videos) setVideos(s.videos)
    if (s.selected) setSelected(s.selected)
  })

  useEffect(() => {
    if (workflow.contentText && !prompt) setPrompt(workflow.contentText)
  }, [workflow.contentText])

  const generate = async () => {
    if (!prompt.trim()) return toast.error('Enter a script or content brief')
    setLoading(true)
    try {
      const { data } = await API.post('/video/generate', {
        workspaceId, prompt, videoType,
        style: style.toLowerCase(), voice: voice.toLowerCase(),
        variantCount, duration,
      })
      setVideos(data.videos)
      setSelected(data.videos[0] || null)
      toast.success(`Generated ${data.videos.length} video variants`)
      fetchMe?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Video generation failed')
    } finally { setLoading(false) }
  }

  const favorite = async (video) => {
    if (!video._id) return
    try {
      await API.post(`/video/favorite/${video._id}`)
      setVideos(prev => prev.map(v => v._id === video._id ? { ...v, favorited: true } : v))
      toast.success('Added to favorites')
    } catch { toast.error('Could not save favorite') }
  }

  return (
    <div className="p-8 max-w-7xl">
      <CoreWorkflowNav stepId="video" canProceed proceedLabel="Continue to Mail" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Video</h1>
        <p className="text-theme-muted/50">Transform content into short-form and long-form video assets with scene breakdowns, captions, and multi-variant generation.</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Video Type</div>
            <div className="space-y-1">
              {VIDEO_TYPES.map(t => (
                <button key={t.id} onClick={() => setVideoType(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${videoType === t.id ? 'bg-curi-blue/15 text-curi-blue' : 'text-theme-muted/50 hover:bg-theme-subtle/5'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Style Preset</div>
            <select className="input text-sm" value={style} onChange={e => setStyle(e.target.value)}>
              {VIDEO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">AI Voice</div>
            <div className="grid grid-cols-2 gap-1.5">
              {VOICES.map(v => (
                <button key={v} onClick={() => setVoice(v)}
                  className={`px-2 py-2 rounded-xl text-xs font-bold transition-all ${voice === v ? 'bg-curi-green/15 text-curi-green' : 'text-theme-muted/50 hover:bg-theme-subtle/5'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Variants</div>
            <div className="flex gap-2">
              {VIDEO_VARIANT_COUNTS.map(n => (
                <button key={n} onClick={() => setVariantCount(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${variantCount === n ? 'bg-curi-blue text-white' : 'bg-theme-subtle/5 text-theme-muted/50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Duration</div>
            <select className="input text-sm" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
            </select>
          </div>
        </div>

        <div className="col-span-2 space-y-5">
          <div className="card p-5">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-3">Script / Brief</div>
            <textarea
              className="input resize-none h-32 text-base"
              placeholder="Paste a script, product page content, blog, or describe your video concept..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-theme-muted/40 font-medium">20 credits per generation</span>
              <button onClick={generate} disabled={loading} className="btn-primary">
                {loading ? 'Generating...' : `Generate ${variantCount} Videos`}
              </button>
            </div>
          </div>

          {selected && (
            <div className="card p-5">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-4">Scene Builder — {selected.title}</div>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-theme-border" />
                <div className="space-y-4">
                  {[{ label: 'Hook', script: selected.hook, visual: 'Opening shot' }, ...(selected.scenes || [])].map((scene, i) => (
                    <div key={i} className="flex gap-4 pl-2">
                      <div className="w-5 h-5 rounded-full bg-curi-gradient flex-shrink-0 relative z-10 mt-0.5" />
                      <div className="flex-1 bg-theme-subtle/5 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-curi-pink">{scene.label}</span>
                          {scene.duration && <span className="text-[10px] text-theme-muted/40">{scene.duration}s</span>}
                        </div>
                        <p className="text-sm text-theme-text font-medium">{scene.script}</p>
                        {scene.visual && <p className="text-xs text-theme-muted/40 mt-1">{scene.visual}</p>}
                      </div>
                    </div>
                  ))}
                  {selected.cta && (
                    <div className="flex gap-4 pl-2">
                      <div className="w-5 h-5 rounded-full bg-curi-yellow flex-shrink-0 relative z-10 mt-0.5" />
                      <div className="flex-1 bg-curi-yellow/10 rounded-xl p-3">
                        <span className="text-xs font-bold text-curi-yellow">CTA</span>
                        <p className="text-sm text-theme-text font-medium mt-1">{selected.cta}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selected.captions?.length > 0 && (
                <div className="mt-5 pt-4 border-t border-theme-border">
                  <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Auto Captions</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.captions.map((c, i) => (
                      <span key={i} className="badge bg-theme-subtle/10 text-theme-muted/60">{c}</span>
                    ))}
                  </div>
                  {selected.highlightWords?.length > 0 && (
                    <div className="mt-2 text-xs text-theme-muted/40">
                      Highlight words: {selected.highlightWords.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <AnimatePresence>
            {videos.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-lg font-bold text-theme-text mb-4">Video Variants</h2>
                <div className="grid grid-cols-2 gap-4">
                  {videos.map((v, i) => (
                    <motion.div key={v._id || v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => setSelected(v)} className={`cursor-pointer rounded-2xl ${selected?._id === v._id ? 'ring-2 ring-curi-blue' : ''}`}>
                      <VideoPreview video={v} onFavorite={favorite} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
