import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Mic, Video, Loader2, Play, Download, ImagePlus, Volume2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'
import {
  TALKING_LANGUAGES,
  TALKING_TONALITIES,
} from '../constants/talkingCharacter'
import {
  ANIMATED_CHARACTERS,
  searchCharacters,
} from '../utils/characterCanvas'
import {
  base64ToBlob,
  createTalkingVideo,
  previewWithBrowserVoice,
} from '../utils/talkingVideo'

const SPEAKABLE_MASCOTS = ANIMATED_CHARACTERS.filter(
  (c) => c.category === 'mascots' || c.speakable,
)

export default function TalkingCharacterStudio({
  workspaceId,
  initialCharacter = null,
  initialImageUrl = null,
  initialScript = '',
  onAddToCanvas,
  applyLabel = 'Add to canvas',
}) {
  const fileRef = useRef(null)
  const [selectedId, setSelectedId] = useState(initialCharacter?.id || 'char-eco-mascot')
  const [uploadPreview, setUploadPreview] = useState(initialImageUrl || null)
  const [script, setScript] = useState(initialScript || '')
  const [language, setLanguage] = useState('en')
  const [tonality, setTonality] = useState('friendly')
  const [generating, setGenerating] = useState(false)
  const [creatingVideo, setCreatingVideo] = useState(false)
  const [audioDataUrl, setAudioDataUrl] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [provider, setProvider] = useState(null)

  const selectedMascot = useMemo(
    () => SPEAKABLE_MASCOTS.find((c) => c.id === selectedId) || null,
    [selectedId],
  )

  const imageUrl = uploadPreview || selectedMascot?.assetUrl || selectedMascot?.previewUrl

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

  const resetOutputs = () => {
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
        await audio.play()
        return
      }
      previewWithBrowserVoice({ text: script.trim(), language: lang, tonality })
      toast.success('Browser voice preview')
    } catch {
      toast.error('Could not preview voice')
    }
  }

  const buildTalkingVideo = async () => {
    if (!imageUrl) return toast.error('Select a mascot or upload an image')
    if (!script.trim()) return toast.error('Enter script text')

    setCreatingVideo(true)
    try {
      let audioUrl = audioDataUrl
      if (!audioUrl) {
        audioUrl = await synthesizeAudio()
        if (!audioUrl) return
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
      toast.success('Talking video ready')
    } catch (err) {
      console.error(err)
      toast.error('Could not create talking video — try again')
    } finally {
      setCreatingVideo(false)
    }
  }

  const addToCanvas = () => {
    if (!imageUrl) return toast.error('Choose a character image')
    if (!audioDataUrl && !videoUrl) {
      toast.error('Generate voice or video first')
      return
    }
    onAddToCanvas?.({
      characterId: selectedMascot?.id,
      imageUrl,
      videoUrl,
      audioDataUrl,
      name: selectedMascot?.name || 'Custom Character',
      script: script.trim(),
      language,
      tonality,
      defaultWidth: selectedMascot?.defaultWidth || 0.5,
    })
    toast.success('Talking character added to canvas')
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
          Make mascots speak your script in any language, or upload your own image for a talking video.
        </p>
      </div>

      <div>
        <div className="text-[10px] font-bold text-theme-muted/50 uppercase tracking-wider mb-1.5">
          Character
        </div>
        <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto mb-2">
          {SPEAKABLE_MASCOTS.slice(0, 12).map((c) => (
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

      <div className="grid grid-cols-2 gap-2">
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
            Tonality
          </label>
          <select
            className="input w-full text-xs mt-1 py-1.5"
            value={tonality}
            onChange={(e) => setTonality(e.target.value)}
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
          Create video
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
              <img src={imageUrl} alt="" className="w-full h-full object-contain p-2" />
              {audioDataUrl && (
                <button
                  type="button"
                  onClick={() => new Audio(audioDataUrl).play()}
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
