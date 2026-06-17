import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Mic, Video, Loader2, Play, Download, ImagePlus, Volume2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'
import {
  TALKING_LANGUAGES,
  TALKING_TONALITIES,
  TALKING_GENDERS,
} from '../constants/talkingCharacter'
import {
  ANIMATED_CHARACTERS,
  CHARACTER_CATEGORIES,
  searchCharacters,
} from '../utils/characterCanvas'
import {
  base64ToBlob,
  createTalkingVideo,
  downloadVideoBlob,
  mediaUrlToDataUrl,
  previewWithBrowserVoice,
  requestLipSyncVideo,
} from '../utils/talkingVideo'

export default function TalkingCharacterStudio({
  workspaceId,
  initialCharacter = null,
  initialImageUrl = null,
  initialScript = '',
  onAddToCanvas,
  applyLabel = 'Add to canvas',
}) {
  const fileRef = useRef(null)
  const [selectedId, setSelectedId] = useState(initialCharacter?.id || null)
  const [uploadPreview, setUploadPreview] = useState(initialImageUrl || null)
  const [category, setCategory] = useState('all')
  const [charSearch, setCharSearch] = useState('')
  const [script, setScript] = useState(initialScript || '')
  const [language, setLanguage] = useState('en')
  const [gender, setGender] = useState('female')
  const [tonality, setTonality] = useState('friendly')
  const [generating, setGenerating] = useState(false)
  const [creatingVideo, setCreatingVideo] = useState(false)
  const [audioDataUrl, setAudioDataUrl] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [provider, setProvider] = useState(null)
  const [previewScale, setPreviewScale] = useState(1)
  const previewAnimRef = useRef(null)

  const filteredCharacters = useMemo(
    () => searchCharacters(charSearch, category),
    [charSearch, category],
  )

  const selectedCharacter = useMemo(
    () => ANIMATED_CHARACTERS.find((c) => c.id === selectedId) || null,
    [selectedId],
  )

  const imageUrl = uploadPreview || selectedCharacter?.assetUrl || selectedCharacter?.previewUrl

  useEffect(() => {
    if (initialCharacter?.id) setSelectedId(initialCharacter.id)
  }, [initialCharacter?.id])

  useEffect(() => {
    if (initialImageUrl) {
      setUploadPreview(initialImageUrl)
      setSelectedId(null)
    }
  }, [initialImageUrl])

  useEffect(() => {
    if (initialScript) setScript(initialScript)
  }, [initialScript])

  const stopPreviewAnim = useCallback(() => {
    if (previewAnimRef.current) {
      cancelAnimationFrame(previewAnimRef.current)
      previewAnimRef.current = null
    }
    setPreviewScale(1)
  }, [])

  const startPreviewAnim = useCallback(() => {
    stopPreviewAnim()
    const start = performance.now()
    const tick = (now) => {
      const t = (now - start) / 1000
      setPreviewScale(1 + Math.abs(Math.sin(t * 14)) * 0.14)
      previewAnimRef.current = requestAnimationFrame(tick)
    }
    previewAnimRef.current = requestAnimationFrame(tick)
  }, [stopPreviewAnim])

  useEffect(() => () => stopPreviewAnim(), [stopPreviewAnim])

  const resetOutputs = () => {
    stopPreviewAnim()
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setAudioDataUrl(null)
    setVideoUrl(null)
    setVideoBlob(null)
    setProvider(null)
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Upload a PNG or JPG image')
      return
    }
    const url = URL.createObjectURL(file)
    setUploadPreview(url)
    setSelectedId(null)
    resetOutputs()
    toast.success('Custom character image ready')
  }

  const synthesizeAudio = async () => {
    if (!script.trim()) {
      toast.error('Enter a script for your character to speak')
      return null
    }
    setGenerating(true)
    resetOutputs()
    try {
      const { data } = await API.post('/design/character/speak', {
        text: script.trim(),
        language,
        tonality,
        gender,
      })
      const mime = data.mimeType || 'audio/mpeg'
      const dataUrl = `data:${mime};base64,${data.audioBase64}`
      setAudioDataUrl(dataUrl)
      setProvider(data.provider)
      toast.success(`Voice generated (${data.provider})`)
      return dataUrl
    } catch (err) {
      if (err.response?.status === 503) {
        toast.error(err.response?.data?.hint || err.response?.data?.error || 'Server voice unavailable — use browser preview')
      } else {
        toast.error(err.response?.data?.error || 'Voice generation failed')
      }
      return null
    } finally {
      setGenerating(false)
    }
  }

  const previewVoice = async () => {
    if (!script.trim()) return toast.error('Enter script text first')
    const lang = TALKING_LANGUAGES.find((l) => l.id === language)?.bcp47 || 'en-US'
    try {
      const dataUrl = audioDataUrl || await synthesizeAudio()
      if (dataUrl) {
        const audio = new Audio(dataUrl)
        startPreviewAnim()
        audio.onended = () => stopPreviewAnim()
        audio.onerror = () => stopPreviewAnim()
        await audio.play()
        return
      }
      startPreviewAnim()
      previewWithBrowserVoice({ text: script.trim(), language: lang, tonality, gender })
      const checkEnd = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(checkEnd)
          stopPreviewAnim()
        }
      }, 200)
      toast.success('Browser voice preview')
    } catch {
      stopPreviewAnim()
      toast.error('Could not preview voice')
    }
  }

  const buildTalkingVideo = async () => {
    if (!imageUrl) return toast.error('Select a character or upload an image')
    if (!script.trim()) return toast.error('Enter script text')

    setCreatingVideo(true)
    const progressId = 'lipsync-progress'
    toast.loading('Generating lip-sync video (mouth matches audio)…', { id: progressId })
    try {
      let audioUrl = audioDataUrl
      if (!audioUrl) {
        audioUrl = await synthesizeAudio()
        if (!audioUrl) return
      }

      const imageDataUrl = await mediaUrlToDataUrl(imageUrl)
      const portrait = Boolean(uploadPreview || initialImageUrl)

      try {
        const lipSync = await requestLipSyncVideo(API, {
          imageDataUrl,
          audioDataUrl: audioUrl,
          portrait,
        })
        const local = await downloadVideoBlob(lipSync.videoUrl)
        if (videoUrl) URL.revokeObjectURL(videoUrl)
        setVideoUrl(local.videoUrl)
        setVideoBlob(local.videoBlob)
        toast.success('Lip-synced video ready — mouth matches speech', { id: progressId })
        return
      } catch (lipErr) {
        const status = lipErr.response?.status
        const hint = lipErr.response?.data?.hint
        if (status === 503) {
          toast.error(hint || 'Real lip-sync needs FAL_KEY on the server', { id: progressId })
        } else if (!lipErr.response) {
          toast.error(lipErr.message || 'Lip-sync failed', { id: progressId })
          return
        } else {
          console.warn('Lip-sync unavailable, using basic animation', lipErr)
          toast.loading('Using basic animation (add FAL_KEY for real lip dubbing)…', { id: progressId })
        }
      }

      const audioBlob = audioUrl.startsWith('data:')
        ? base64ToBlob(audioUrl.split(',')[1], 'audio/mpeg')
        : await fetch(audioUrl).then((r) => r.blob())

      const result = await createTalkingVideo({
        imageUrl,
        audioBlob,
        backgroundColor: '#FFB6C8',
      })

      if (videoUrl) URL.revokeObjectURL(videoUrl)
      setVideoUrl(result.videoUrl)
      setVideoBlob(result.videoBlob)
      toast.success('Talking video ready (basic animation)', { id: progressId })
    } catch (err) {
      console.error(err)
      toast.error('Could not create talking video — try again', { id: progressId })
    } finally {
      setCreatingVideo(false)
    }
  }

  const addToCanvas = async () => {
    if (!imageUrl) return toast.error('Choose a character image')
    if (!audioDataUrl && !videoUrl) {
      toast.error('Generate voice or video first')
      return
    }
    try {
      const persistedImageUrl = await mediaUrlToDataUrl(imageUrl)
      const persistedVideoUrl = videoUrl ? await mediaUrlToDataUrl(videoUrl) : null
      onAddToCanvas?.({
        characterId: selectedCharacter?.id,
        imageUrl: persistedImageUrl || imageUrl,
        videoUrl: persistedVideoUrl || videoUrl,
        audioDataUrl,
        name: selectedCharacter?.name || 'Custom Character',
        script: script.trim(),
        language,
        tonality,
        gender,
        defaultWidth: selectedCharacter?.defaultWidth || 0.5,
        speakTrigger: Date.now(),
      })
      toast.success('Talking character added to canvas')
    } catch (err) {
      console.error(err)
      toast.error('Could not prepare character for canvas')
    }
  }

  const downloadVideo = useCallback(() => {
    if (!videoBlob) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `curi-talking-${Date.now()}.webm`
    a.click()
  }, [videoBlob, videoUrl])

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-bold text-theme-text">Talking Character Studio</div>
        <p className="text-[10px] text-theme-muted/55 mt-0.5 leading-snug">
          Upload a portrait or pick a character, write a script, then create a lip-synced video where the mouth matches the audio.
        </p>
      </div>

      <div>
        <div className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider mb-1.5">
          Character
        </div>
        <input
          type="search"
          value={charSearch}
          onChange={(e) => setCharSearch(e.target.value)}
          placeholder="Search all characters…"
          className="input w-full text-xs py-1.5 mb-2"
        />
        <div className="flex flex-wrap gap-1 mb-2 max-h-14 overflow-y-auto">
          {CHARACTER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                category === cat.id
                  ? 'bg-curi-pink text-white'
                  : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto mb-2">
          {filteredCharacters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedId(c.id)
                setUploadPreview(null)
                resetOutputs()
              }}
              title={c.name}
              className={`aspect-square rounded-lg border-2 overflow-hidden p-0.5 transition-all ${
                selectedId === c.id && !uploadPreview
                  ? 'border-curi-pink bg-curi-pink/10'
                  : 'border-theme-border hover:border-curi-pink/40'
              }`}
            >
              <img src={c.previewUrl} alt={c.name} className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
        {filteredCharacters.length === 0 && (
          <p className="text-[10px] text-theme-muted/50 text-center mb-2">No characters match</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
        >
          <Upload size={14} />
          Upload photo of a person
        </button>
        <p className="text-[10px] text-theme-muted/45 mt-1 text-center">
          PNG, JPG, or WebP — turn any portrait into a talking video
        </p>
        {uploadPreview && (
          <p className="text-[10px] text-curi-green mt-1 flex items-center gap-1">
            <ImagePlus size={12} /> Custom image selected
          </p>
        )}
      </div>

      <div>
        <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">
          Script
        </label>
        <textarea
          className="input w-full text-xs mt-1 h-20 resize-none"
          placeholder="What should your character say?"
          value={script}
          onChange={(e) => {
            setScript(e.target.value)
            resetOutputs()
          }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">
            Language
          </label>
          <select
            className="input w-full text-xs mt-1 py-1.5"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {TALKING_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">
            Voice gender
          </label>
          <select
            className="input w-full text-xs mt-1 py-1.5"
            value={gender}
            onChange={(e) => {
              setGender(e.target.value)
              resetOutputs()
            }}
          >
            {TALKING_GENDERS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider">
            Tonality
          </label>
          <select
            className="input w-full text-xs mt-1 py-1.5"
            value={tonality}
            onChange={(e) => {
              setTonality(e.target.value)
              resetOutputs()
            }}
          >
            {TALKING_TONALITIES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={previewVoice}
          disabled={generating || !script.trim()}
          className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1 min-w-[120px]"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          Preview voice
        </button>
        <button
          type="button"
          onClick={buildTalkingVideo}
          disabled={creatingVideo || !script.trim() || !imageUrl}
          className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1 min-w-[120px]"
        >
          {creatingVideo ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
          Create lip-sync video
        </button>
      </div>

      {provider && (
        <p className="text-[10px] text-theme-muted/50">
          Voice by {provider} · 1 AI credit
        </p>
      )}

      {(audioDataUrl || videoUrl) && (
        <div className="card p-2 space-y-2">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full rounded-lg bg-black/5 max-h-36"
              poster={imageUrl}
            />
          ) : imageUrl ? (
            <div className="relative aspect-square max-h-28 mx-auto rounded-lg overflow-hidden bg-gradient-to-br from-pink-100 to-blue-50">
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-contain p-2 transition-transform duration-75"
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'center bottom',
                }}
              />
              {audioDataUrl && (
                <button
                  type="button"
                  onClick={() => {
                    startPreviewAnim()
                    const audio = new Audio(audioDataUrl)
                    audio.onended = () => stopPreviewAnim()
                    audio.onerror = () => stopPreviewAnim()
                    audio.play()
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Play size={28} className="text-white" />
                </button>
              )}
            </div>
          ) : null}
          {audioDataUrl && !videoUrl && (
            <audio src={audioDataUrl} controls className="w-full h-8" />
          )}
          <div className="flex gap-2">
            {videoBlob && (
              <button
                type="button"
                onClick={downloadVideo}
                className="btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
              >
                <Download size={12} /> Download
              </button>
            )}
            <button
              type="button"
              onClick={addToCanvas}
              className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
            >
              <Mic size={12} /> {applyLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
