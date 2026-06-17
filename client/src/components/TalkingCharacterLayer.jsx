import { useCallback, useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { previewWithBrowserVoice } from '../utils/talkingVideo'
import { TALKING_LANGUAGES } from '../constants/talkingCharacter'

export default function TalkingCharacterLayer({
  el,
  scale,
  interactive,
  onSelect,
}) {
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const animRef = useRef(null)
  const [animScale, setAnimScale] = useState(1)
  const [playing, setPlaying] = useState(false)

  const stopAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    setAnimScale(1)
    setPlaying(false)
  }, [])

  const runBounceAnim = useCallback(() => {
    stopAnim()
    setPlaying(true)
    const start = performance.now()
    const tick = (now) => {
      const t = (now - start) / 1000
      setAnimScale(1 + Math.abs(Math.sin(t * 14)) * 0.12)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [stopAnim])

  const playAudio = useCallback(async () => {
    if (!el.audioDataUrl) return false
    stopAnim()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    const audio = new Audio(el.audioDataUrl)
    audio.playbackRate = el.videoSpeed || 1
    audioRef.current = audio
    runBounceAnim()
    audio.onended = () => stopAnim()
    audio.onerror = () => stopAnim()
    try {
      await audio.play()
      return true
    } catch {
      stopAnim()
      return false
    }
  }, [el.audioDataUrl, el.videoSpeed, runBounceAnim, stopAnim])

  const playSpeech = useCallback(async () => {
    if (el.videoUrl && videoRef.current) {
      stopAnim()
      setPlaying(true)
      try {
        videoRef.current.currentTime = 0
        await videoRef.current.play()
      } catch {
        setPlaying(false)
      }
      return
    }

    if (el.audioDataUrl) {
      await playAudio()
      return
    }

    if (el.script?.trim() && window.speechSynthesis) {
      runBounceAnim()
      const lang = TALKING_LANGUAGES.find((l) => l.id === el.language)?.bcp47 || 'en-US'
      previewWithBrowserVoice({
        text: el.script.trim(),
        language: lang,
        tonality: el.tonality || 'friendly',
        gender: el.gender || 'female',
      })
      const checkEnd = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(checkEnd)
          stopAnim()
        }
      }, 200)
      return
    }
  }, [el, playAudio, runBounceAnim, stopAnim])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = el.videoSpeed || 1
    }
  }, [el.videoSpeed, el.videoUrl])

  useEffect(() => {
    if (!el.speakTrigger) return undefined
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      if (el.videoUrl && videoRef.current) {
        setPlaying(true)
        try {
          videoRef.current.currentTime = 0
          await videoRef.current.play()
        } catch {
          setPlaying(false)
        }
        return
      }
      await playAudio()
    }
    run()
    return () => { cancelled = true }
  }, [el.speakTrigger, el.videoUrl, playAudio])

  useEffect(() => () => {
    stopAnim()
    audioRef.current?.pause()
  }, [stopAnim])

  const base = {
    position: 'absolute',
    left: el.x * scale,
    top: el.y * scale,
    width: el.width * scale,
    cursor: interactive ? 'move' : 'default',
    zIndex: el.zIndex ?? 2,
  }
  const height = (el.height || el.width) * scale

  if (el.videoUrl) {
    return (
      <video
        ref={videoRef}
        key={el.id}
        src={el.videoUrl}
        poster={el.posterUrl || el.url}
        controls={interactive}
        playsInline
        loop={false}
        muted={false}
        draggable={false}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => { e.currentTarget.playbackRate = el.videoSpeed || 1 }}
        style={{
          ...base,
          height,
          objectFit: 'contain',
          borderRadius: 8 * scale,
        }}
        onClick={interactive ? (e) => { e.stopPropagation(); onSelect?.(el.id) } : undefined}
      />
    )
  }

  return (
    <div
      key={el.id}
      style={{ ...base, height }}
      onClick={interactive ? (e) => {
        e.stopPropagation()
        onSelect?.(el.id)
      } : undefined}
    >
      <img
        src={el.url}
        alt={el.name || ''}
        draggable={false}
        className="w-full h-full object-contain transition-transform duration-75"
        style={{
          transform: `scale(${animScale})`,
          transformOrigin: 'center bottom',
        }}
      />
      {(el.audioDataUrl || el.script) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            playSpeech()
          }}
          className={`absolute bottom-1 right-1 rounded-full text-white p-1 shadow-md z-10 pointer-events-auto ${
            playing ? 'bg-curi-pink' : 'bg-curi-green/90 hover:bg-curi-green'
          }`}
          style={{ width: 24 * scale, height: 24 * scale }}
          title="Play speech"
        >
          <Play size={12 * scale} className="mx-auto" fill="currentColor" />
        </button>
      )}
    </div>
  )
}
