import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, Pause, Square, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  buildSceneTimeline,
  speakScene,
  stopSpeech,
  voiceToTonality,
  VIDEO_TYPE_GRADIENT,
} from '../utils/videoPreview'

export default function VideoStoryboardPlayer({ video, compact = false, autoPlayToken = 0 }) {
  const scenes = useMemo(() => buildSceneTimeline(video), [video])
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const abortRef = useRef(false)
  const runIdRef = useRef(0)

  const gradient = VIDEO_TYPE_GRADIENT[video?.videoType] || VIDEO_TYPE_GRADIENT.motion_graphics
  const current = scenes[sceneIndex] || null
  const tonality = voiceToTonality(video?.voice)

  const reset = useCallback(() => {
    abortRef.current = true
    runIdRef.current += 1
    stopSpeech()
    setPlaying(false)
    setLoading(false)
    setSceneIndex(0)
  }, [])

  useEffect(() => () => reset(), [reset])

  useEffect(() => {
    reset()
  }, [video?._id, video?.id, reset])

  const playAll = useCallback(async () => {
    if (!scenes.length) {
      toast.error('No scenes to preview')
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    abortRef.current = false
    setLoading(true)
    setPlaying(true)

    try {
      for (let i = 0; i < scenes.length; i += 1) {
        if (abortRef.current || runIdRef.current !== runId) return
        setSceneIndex(i)
        setLoading(false)
        await speakScene({
          text: scenes[i].script,
          tonality,
        })
        if (abortRef.current || runIdRef.current !== runId) return
        await new Promise((r) => setTimeout(r, 350))
      }
      if (!abortRef.current && runIdRef.current === runId) {
        toast.success('Preview complete')
      }
    } catch (err) {
      toast.error(err.message || 'Could not play preview')
    } finally {
      if (runIdRef.current === runId) {
        setPlaying(false)
        setLoading(false)
      }
    }
  }, [scenes, tonality])

  useEffect(() => {
    if (autoPlayToken > 0 && scenes.length) {
      playAll()
    }
  }, [autoPlayToken, scenes.length, playAll])

  const togglePlay = () => {
    if (playing || loading) {
      reset()
      return
    }
    playAll()
  }

  if (!video) return null

  const heightClass = compact ? 'min-h-[200px]' : 'min-h-[320px] lg:min-h-[380px]'
  const stock = current?.stockMedia

  return (
    <div className={`rounded-2xl overflow-hidden border border-theme-border bg-theme-subtle/5 ${compact ? '' : 'mb-4'}`}>
      <div className={`relative ${heightClass} flex flex-col justify-between p-5 text-white overflow-hidden`}>
        {stock?.type === 'video' && stock.url ? (
          <video
            key={`${sceneIndex}-${stock.url}`}
            src={stock.url}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : stock?.url ? (
          <img
            key={`${sceneIndex}-${stock.url}`}
            src={stock.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/35" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <span className="badge bg-white/15 text-white text-[10px] uppercase tracking-wide">
              {video.videoTypeLabel || video.videoType?.replace(/_/g, ' ') || 'Video preview'}
            </span>
            {current && (
              <div className="mt-2 text-xs font-bold uppercase tracking-wider text-white/70">
                {current.label}
                {scenes.length > 1 && ` · ${sceneIndex + 1}/${scenes.length}`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!scenes.length}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-all disabled:opacity-40"
              title={playing || loading ? 'Stop preview' : 'Play storyboard preview'}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            {(playing || loading) && (
              <button
                type="button"
                onClick={reset}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                title="Stop"
              >
                <Square size={14} fill="currentColor" />
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 space-y-3 mt-auto">
          {playing && (
            <div className="h-1 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white/80 transition-all duration-300"
                style={{ width: `${scenes.length ? ((sceneIndex + 1) / scenes.length) * 100 : 0}%` }}
              />
            </div>
          )}
          <p className={`font-bold leading-snug ${compact ? 'text-sm line-clamp-4' : 'text-lg lg:text-xl'}`}>
            {current?.script || video.hook || video.title}
          </p>
          {current?.visual && !compact && (
            <p className="text-sm text-white/65">{current.visual}</p>
          )}
        </div>

        {(playing || loading) && (
          <div className="absolute inset-0 pointer-events-none bg-white/5 animate-pulse z-[1]" />
        )}
      </div>

      {!compact && (
        <div className="px-4 py-3 text-xs text-theme-muted/55 border-t border-theme-border/40 flex flex-wrap items-center justify-between gap-2">
          <span>
            {video.stockIndustry
              ? `Stock b-roll matched to ${video.stockIndustry} — edit scenes before launch.`
              : 'Storyboard preview with voice narration — edit before launch.'}
          </span>
          <span className="capitalize">{video.voice || 'professional'} voice</span>
        </div>
      )}
    </div>
  )
}
