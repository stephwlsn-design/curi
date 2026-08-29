import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import VideoStoryboardPlayer from '../components/VideoStoryboardPlayer'
import { VIDEO_TYPES, VIDEO_STYLES, VOICES } from '../constants/creative'
import { Pencil, Rocket, Save, Sparkles } from 'lucide-react'

const buildGeneratePrompt = (creativeBrief, narrationBrief) => {
  const creative = creativeBrief.trim()
  const narration = narrationBrief.trim()
  if (creative && narration) return `${creative}\n\n--- NARRATION ---\n\n${narration}`
  return narration || creative
}

const NARRATION_LOADING = (label) => `Writing concise ${label} narration…

Hook · Scene beats · Short visuals`

const isLoadingNarration = (text) => /^Writing concise|^Generating |Hook · Scene beats/i.test(String(text || '').trim())

const extractTopicSeed = (creative, workflow) => {
  const workflowSeed = (workflow.contentText || workflow.topic || '').trim()
  const creativeText = String(creative || '').trim()
  if (!creativeText) return workflowSeed
  const focus = creativeText.match(/^Focus angle:\s*(.+)$/im)?.[1]?.trim()
  if (focus) return focus
  if (/^(Audience|Core message|Structure|Tone):/im.test(creativeText)) return workflowSeed
  return workflowSeed || creativeText.slice(0, 240)
}

const buildEditableScenes = (video) => {
  if (!video) return []
  const rows = []
  if (video.hook) {
    rows.push({
      key: 'hook',
      label: 'Hook',
      script: video.hook,
      visual: video.hookVisual || 'Opening shot',
      duration: 3,
      isHook: true,
      stockMedia: video.hookStockMedia || null,
    })
  }
  for (const [i, scene] of (video.scenes || []).entries()) {
    rows.push({
      key: `scene-${i}`,
      label: scene.label || `Scene ${i + 1}`,
      script: scene.script || '',
      visual: scene.visual || '',
      duration: scene.duration || 5,
      stockMedia: scene.stockMedia || null,
    })
  }
  if (video.cta) {
    rows.push({ key: 'cta', label: 'CTA', script: video.cta, visual: 'Call to action', duration: 4, isCta: true })
  }
  return rows
}

const scenesToPayload = (rows, baseVideo) => {
  const hookRow = rows.find((r) => r.isHook)
  const ctaRow = rows.find((r) => r.isCta)
  const sceneRows = rows.filter((r) => !r.isHook && !r.isCta)
  return {
    ...baseVideo,
    hook: hookRow?.script || baseVideo.hook,
    cta: ctaRow?.script || baseVideo.cta,
    scenes: sceneRows.map((row, i) => ({
      label: row.label || `Scene ${i + 1}`,
      script: row.script,
      visual: row.visual,
      duration: Number(row.duration) || 5,
      stockMedia: row.stockMedia || baseVideo.scenes?.[i]?.stockMedia || null,
    })),
  }
}

export default function Video() {
  const navigate = useNavigate()
  const { workspaceId, workspace, fetchMe } = useAuth()
  const { workflow, addVideo } = useCoreWorkflow()
  const industry = workspace?.brandProfile?.industry || workspace?.onboarding?.industry || 'your industry'

  const [creativeBrief, setCreativeBrief] = useState(workflow.contentText || '')
  const [narrationBrief, setNarrationBrief] = useState('')
  const [videoType, setVideoType] = useState('motion_graphics')
  const videoTypeRef = useRef('motion_graphics')
  const selectedVideoType = VIDEO_TYPES.find((t) => t.id === videoType) || VIDEO_TYPES[2]
  const [style, setStyle] = useState('Professional')
  const [voice, setVoice] = useState('Professional')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(false)
  const [briefLoading, setBriefLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [video, setVideo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editRows, setEditRows] = useState([])
  const [playRequest, setPlayRequest] = useState(0)
  const briefLoadingRef = useRef(false)

  useDraftModule('video', () => ({
    creativeBrief, narrationBrief, prompt: buildGeneratePrompt(creativeBrief, narrationBrief),
    videoType, style, voice, duration, video, selected: video,
  }), (s) => {
    if (s.creativeBrief) setCreativeBrief(s.creativeBrief)
    if (s.narrationBrief) setNarrationBrief(s.narrationBrief)
    if (s.prompt && !s.creativeBrief && !s.narrationBrief) setCreativeBrief(s.prompt)
    if (s.videoType) setVideoType(s.videoType)
    if (s.style) setStyle(s.style)
    if (s.voice) setVoice(s.voice)
    if (s.duration) setDuration(s.duration)
    if (s.video || s.selected) setVideo(s.video || s.selected)
  })

  useEffect(() => {
    videoTypeRef.current = videoType
  }, [videoType])

  useEffect(() => {
    if (workflow.contentText && !creativeBrief && !narrationBrief) setCreativeBrief(workflow.contentText)
  }, [workflow.contentText])

  const generateBrief = async ({ typeId = videoType, silent = false, topicHint: topicOverride } = {}) => {
    if (!workspaceId) return toast.error('Workspace not loaded')
    if (briefLoadingRef.current) return

    const typeMeta = VIDEO_TYPES.find((t) => t.id === typeId) || VIDEO_TYPES[2]
    briefLoadingRef.current = true
    setBriefLoading(true)
    setNarrationBrief(NARRATION_LOADING(typeMeta.label))
    try {
      const topicHint = topicOverride ?? extractTopicSeed(creativeBrief, workflow)
      const { data } = await API.post('/video/brief', {
        workspaceId,
        videoType: typeId,
        style: style.toLowerCase(),
        duration,
        topicHint,
      }, { timeout: 45000 })
      if (!data.brief?.trim() && !data.narrationBrief?.trim()) {
        toast.error('Could not generate brief — try again')
        setNarrationBrief('')
        return
      }
      if (data.creativeBrief) setCreativeBrief(data.creativeBrief.trim())
      if (data.narrationBrief) setNarrationBrief(data.narrationBrief.trim())
      else if (data.brief) {
        const parts = data.brief.split(/\n---\s*NARRATION\s*---\n/i)
        if (parts[0]) setCreativeBrief(parts[0].trim())
        if (parts[1]) setNarrationBrief(parts[1].trim())
        else setCreativeBrief(data.brief.trim())
      }
      if (!silent) {
        const briefLabel = data.videoTypeLabel || typeMeta.label
        if (data.warning) toast(data.warning, { icon: 'ℹ️' })
        else if (data.source === 'fallback') {
          toast.success(`${briefLabel} brief + narration drafted from brand profile`)
        } else {
          toast.success(`${briefLabel} brief + narration generated`)
        }
      }
    } catch (err) {
      setNarrationBrief('')
      const isTimeout = err.code === 'ECONNABORTED' || String(err.message || '').includes('timeout')
      toast.error(isTimeout ? 'Brief generation timed out — try again' : (err.response?.data?.error || 'Brief generation failed'))
    } finally {
      briefLoadingRef.current = false
      setBriefLoading(false)
    }
  }

  const selectVideoType = (id) => {
    if (id === videoType || briefLoadingRef.current || loading) return
    videoTypeRef.current = id
    setVideoType(id)
    setVideo(null)
    setEditing(false)
    setCreativeBrief('')
    setNarrationBrief(NARRATION_LOADING(VIDEO_TYPES.find((t) => t.id === id)?.label || 'video'))
    generateBrief({
      typeId: id,
      topicHint: workflow.contentText || workflow.topic || '',
      silent: true,
    })
  }

  const generate = async () => {
    if (briefLoading || isLoadingNarration(narrationBrief)) {
      return toast.error('Wait for the brief to finish generating')
    }
    const narration = narrationBrief.trim()
    const creative = creativeBrief.trim()
    const validNarration = narration && !isLoadingNarration(narration)
    const briefText = buildGeneratePrompt(creative, validNarration ? narration : '')
    if (!briefText) return toast.error('Enter a script or content brief')
    if (!workspaceId) return toast.error('Workspace not loaded')
    const activeVideoType = videoTypeRef.current
    setLoading(true)
    setEditing(false)
    try {
      const { data } = await API.post('/video/generate', {
        workspaceId,
        prompt: briefText,
        creativeBrief: creative,
        narrationBrief: validNarration ? narration : '',
        videoType: activeVideoType,
        style: style.toLowerCase(), voice: voice.toLowerCase(),
        duration,
      }, { timeout: 120000 })
      const created = data.videos?.[0]
      if (!created) {
        toast.error('Video could not be generated — try again')
        return
      }
      setVideo(created)
      addVideo(created)
      setPlayRequest((n) => n + 1)
      if (data.warning) toast(data.warning, { icon: '⚠️' })
      else {
        const typeLabel = created.videoTypeLabel || selectedVideoType.label
        toast.success(`${typeLabel} video created with industry stock media`)
      }
      fetchMe?.()
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || String(err.message || '').includes('timeout')
      toast.error(
        isTimeout
          ? 'Video generation timed out — try a shorter brief'
          : (err.response?.data?.error || 'Video generation failed'),
      )
    } finally { setLoading(false) }
  }

  const startEditing = () => {
    if (!video) return
    setEditRows(buildEditableScenes(video))
    setEditing(true)
  }

  const persistVideo = async ({ silent = false } = {}) => {
    if (!video?._id || !workspaceId) return true

    if (!editing) {
      addVideo(video)
      return true
    }

    setSaving(true)
    try {
      const payload = scenesToPayload(editRows, video)
      const { data } = await API.patch(`/video/${video._id}`, {
        workspaceId,
        title: payload.title,
        hook: payload.hook,
        cta: payload.cta,
        scenes: payload.scenes,
        captions: payload.captions,
        highlightWords: payload.highlightWords,
      })
      const updated = data.video || payload
      setVideo(updated)
      addVideo(updated)
      setEditing(false)
      if (!silent) toast.success('Video saved')
      return true
    } catch {
      toast.error('Could not save video')
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveEdits = () => persistVideo()

  const handleBeforeLeave = async () => persistVideo({ silent: true })

  const updateRow = (key, field, value) => {
    setEditRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  }

  const continueToLaunch = async () => {
    const ok = await persistVideo({ silent: true })
    if (!ok) return
    navigate('/launch')
  }

  return (
    <PageShell>
      <CoreWorkflowNav stepId="video" canProceed proceedLabel="Continue to Mail" onBeforeLeave={handleBeforeLeave} />

      <PageHeader
        title="Curi Video"
        description={`Create one on-brand video for ${industry} with AI script, stock b-roll, and voice preview — edit before you launch.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <div className="page-card">
          <div className="section-label mb-3">Video Type</div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {VIDEO_TYPES.map(t => (
              <button key={t.id} onClick={() => selectVideoType(t.id)}
                disabled={briefLoading || loading}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-base font-medium transition-all disabled:opacity-50 ${videoType === t.id ? 'bg-curi-blue/15 text-curi-blue' : 'text-theme-muted/60 hover:bg-theme-subtle/5'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-theme-muted/55 leading-relaxed border-t border-theme-border/40 pt-3">
            {selectedVideoType.hint}
            {briefLoading ? ' · Updating brief…' : ' · Brief regenerates when you switch type.'}
          </p>
        </div>

        <div className="page-card space-y-4">
          <div>
            <div className="section-label mb-2">Style Preset</div>
            <select className="input w-full" value={style} onChange={e => setStyle(e.target.value)}>
              {VIDEO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="section-label mb-2">AI Voice</div>
            <div className="grid grid-cols-2 gap-2">
              {VOICES.map(v => (
                <button key={v} onClick={() => setVoice(v)}
                  className={`px-2 py-2.5 rounded-xl text-sm font-bold transition-all ${voice === v ? 'bg-curi-green/15 text-curi-green' : 'text-theme-muted/60 hover:bg-theme-subtle/5'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="page-card space-y-4">
          <div>
            <div className="section-label mb-2">Duration</div>
            <select className="input w-full" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
            </select>
          </div>
          <div className="rounded-xl bg-theme-subtle/5 border border-theme-border/40 p-3 text-xs text-theme-muted/60 leading-relaxed">
            Stock photos and videos from Pexels are matched automatically using your <span className="font-bold text-theme-text">{industry}</span> industry profile.
          </div>
        </div>
      </div>

      <div className="page-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="section-label">Brief &amp; Narration</div>
          <button
            type="button"
            onClick={() => generateBrief()}
            disabled={briefLoading || loading}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Sparkles size={14} />
            {briefLoading ? `Creating ${selectedVideoType.label} brief…` : `Generate ${selectedVideoType.label} brief`}
          </button>
        </div>
        <p className="text-xs text-theme-muted/55 mb-4 leading-relaxed">
          Generate a creative brief and scene-by-scene narration from your Brand Hub profile, or write your own.
          {workflow.contentText && !creativeBrief ? ' Workflow content will seed the brief.' : ''}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-theme-muted/50 mb-2">Creative brief</div>
            <textarea
              className="input resize-none h-36 lg:h-40 text-sm w-full"
              placeholder={`Strategy for your ${selectedVideoType.label.toLowerCase()} — audience, message, angle…`}
              value={creativeBrief}
              onChange={(e) => setCreativeBrief(e.target.value)}
              disabled={briefLoading}
            />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-theme-muted/50 mb-2 flex items-center gap-2">
              Narration brief
              {briefLoading && <span className="text-curi-blue normal-case font-medium animate-pulse">Writing voiceover…</span>}
            </div>
            <textarea
              className={`input resize-none h-36 lg:h-40 text-sm w-full ${briefLoading ? 'opacity-80' : ''}`}
              placeholder={`Short voiceover lines only — ~8-14 words per scene for ${selectedVideoType.label.toLowerCase()}…`}
              value={narrationBrief}
              onChange={(e) => setNarrationBrief(e.target.value)}
              disabled={briefLoading}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-sm text-theme-muted/50 font-medium">
            20 credits · {selectedVideoType.label} · 1 video
          </span>
          <button onClick={generate} disabled={loading || briefLoading} className="btn-primary text-base px-6 py-3">
            {loading ? `Creating ${selectedVideoType.label}…` : briefLoading ? 'Waiting for brief…' : `Create ${selectedVideoType.label}`}
          </button>
        </div>
      </div>

      {video && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="section-label mb-1">Your video</div>
              <h2 className="text-xl font-bold text-theme-text">{video.title}</h2>
              <p className="text-xs text-theme-muted/55 mt-1">
                {(video.videoTypeLabel || selectedVideoType.label).replace(/_/g, ' ')}
                {video.stockIndustry ? ` · Stock media · ${video.stockIndustry}` : ''}
              </p>
              {video.sourceBrief && (
                <p className="text-xs text-theme-muted/45 mt-2 line-clamp-2" title={video.sourceBrief}>
                  From brief: {video.sourceBrief.slice(0, 120)}{video.sourceBrief.length > 120 ? '…' : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!editing ? (
                <button type="button" onClick={startEditing} className="btn-secondary text-sm flex items-center gap-2">
                  <Pencil size={14} /> Edit before launch
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
                  <button type="button" onClick={saveEdits} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                    <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
              <button type="button" onClick={continueToLaunch} className="btn-primary text-sm flex items-center gap-2">
                <Rocket size={14} /> Continue to Launch
              </button>
            </div>
          </div>

          <div id="video-storyboard-player">
            <VideoStoryboardPlayer video={video} autoPlayToken={playRequest} />
          </div>

          <div className="section-label mb-4 mt-6">{editing ? 'Edit scenes' : 'Scene breakdown'}</div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-theme-border" />
            <div className="space-y-4">
              {(editing ? editRows : buildEditableScenes(video)).map((scene) => (
                <div key={scene.key} className="flex gap-4 pl-2">
                  <div className="w-5 h-5 rounded-full bg-curi-gradient flex-shrink-0 relative z-10 mt-0.5" />
                  <div className="flex-1 bg-theme-subtle/5 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2 gap-3">
                      {editing ? (
                        <input
                          className="input text-sm flex-1"
                          value={scene.label}
                          onChange={(e) => updateRow(scene.key, 'label', e.target.value)}
                          disabled={scene.isHook || scene.isCta}
                        />
                      ) : (
                        <span className="text-sm font-bold text-curi-pink">{scene.label}</span>
                      )}
                      {!scene.isHook && !scene.isCta && editing && (
                        <input
                          type="number"
                          min={2}
                          max={30}
                          className="input text-xs w-20"
                          value={scene.duration}
                          onChange={(e) => updateRow(scene.key, 'duration', e.target.value)}
                        />
                      )}
                      {!editing && scene.duration && (
                        <span className="text-xs text-theme-muted/50">{scene.duration}s</span>
                      )}
                    </div>
                    {editing ? (
                      <>
                        <textarea
                          className="input text-sm w-full min-h-[72px] mb-2"
                          value={scene.script}
                          onChange={(e) => updateRow(scene.key, 'script', e.target.value)}
                        />
                        {!scene.isHook && !scene.isCta && (
                          <input
                            className="input text-sm w-full"
                            placeholder="Visual direction"
                            value={scene.visual}
                            onChange={(e) => updateRow(scene.key, 'visual', e.target.value)}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-base text-theme-text font-medium">{scene.script}</p>
                        {scene.visual && <p className="text-sm text-theme-muted/50 mt-1">{scene.visual}</p>}
                      </>
                    )}
                    {scene.stockMedia?.url && !editing && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-16 h-10 rounded-lg overflow-hidden border border-theme-border/40 bg-theme-subtle/10 flex-shrink-0">
                          {scene.stockMedia.type === 'video' ? (
                            <video src={scene.stockMedia.url} className="w-full h-full object-cover" muted playsInline />
                          ) : (
                            <img src={scene.stockMedia.thumbnailUrl || scene.stockMedia.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="text-[10px] text-theme-muted/45 uppercase tracking-wide">
                          Stock {scene.stockMedia.type} · Pexels
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {video.captions?.length > 0 && !editing && (
            <div className="mt-5 pt-4 border-t border-theme-border">
              <div className="section-label mb-3">Auto Captions</div>
              <div className="flex flex-wrap gap-2">
                {video.captions.map((c, i) => (
                  <span key={i} className="badge bg-theme-subtle/10 text-theme-muted/60">{c}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </PageShell>
  )
}
