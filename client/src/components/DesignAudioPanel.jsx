import { useMemo, useRef, useState } from 'react'
import {
  Volume2, Mic, Music, Upload, Loader2, Play, Pause, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'
import {
  TALKING_LANGUAGES,
  TALKING_TONALITIES,
} from '../constants/talkingCharacter'
import {
  AUDIO_CATEGORIES,
  searchAudioClips,
} from '../utils/audioCanvas'
import { previewWithBrowserVoice } from '../utils/talkingVideo'

const MODES = [
  { id: 'voice', label: 'AI Voice', icon: Mic },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'upload', label: 'Upload', icon: Upload },
]

export default function DesignAudioPanel({
  embedded = false,
  searchQuery = '',
  onSearchChange,
  onAddAudio,
  currentAudio,
}) {
  const fileRef = useRef(null)
  const previewRef = useRef(null)
  const [mode, setMode] = useState('voice')
  const [category, setCategory] = useState('all')
  const [internalSearch, setInternalSearch] = useState('')
  const [script, setScript] = useState('')
  const [language, setLanguage] = useState('en')
  const [tonality, setTonality] = useState('friendly')
  const [generating, setGenerating] = useState(false)
  const [playingId, setPlayingId] = useState(null)

  const search = onSearchChange ? searchQuery : internalSearch
  const setSearch = onSearchChange || setInternalSearch

  const filteredClips = useMemo(
    () => searchAudioClips(search, category),
    [search, category],
  )

  const stopPreview = () => {
    if (previewRef.current) {
      previewRef.current.pause()
      previewRef.current = null
    }
    setPlayingId(null)
  }

  const toggleClipPreview = (clip) => {
    if (playingId === clip.id) {
      stopPreview()
      return
    }
    stopPreview()
    const audio = new Audio(clip.previewUrl)
    previewRef.current = audio
    setPlayingId(clip.id)
    audio.play().catch(() => toast.error('Could not play preview'))
    audio.onended = () => setPlayingId(null)
  }

  const handleAddClip = (clip) => {
    stopPreview()
    onAddAudio?.({
      id: clip.id,
      name: clip.name,
      type: clip.category === 'sfx' ? 'sfx' : 'music',
      url: clip.previewUrl,
      loop: clip.category !== 'sfx',
    })
    toast.success(`Added ${clip.name}`)
  }

  const synthesizeVoice = async () => {
    if (!script.trim()) return toast.error('Enter a script for the voiceover')
    setGenerating(true)
    try {
      const { data } = await API.post('/design/character/speak', {
        text: script.trim(),
        language,
        tonality,
      })
      const mime = data.mimeType || 'audio/mpeg'
      const dataUrl = `data:${mime};base64,${data.audioBase64}`
      onAddAudio?.({
        name: 'AI Voiceover',
        type: 'voice',
        dataUrl,
        url: dataUrl,
        script: script.trim(),
        language,
        tonality,
        provider: data.provider,
        loop: false,
      })
      toast.success(`Voice added (${data.provider})`)
    } catch (err) {
      const lang = TALKING_LANGUAGES.find((l) => l.id === language)?.bcp47 || 'en-US'
      try {
        previewWithBrowserVoice({ text: script.trim(), language: lang, tonality })
        toast.error(err.response?.data?.hint || 'AI voice failed — browser preview only')
      } catch {
        toast.error(err.response?.data?.error || 'Voice generation failed')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Upload an audio file (MP3, WAV, M4A)')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Audio must be under 8 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onAddAudio?.({
        name: file.name.replace(/\.[^.]+$/, ''),
        type: 'upload',
        dataUrl: reader.result,
        url: reader.result,
        loop: false,
      })
      toast.success('Audio uploaded')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={embedded ? 'space-y-3' : 'card p-5'}>
      {!embedded && (
        <div className="mb-3 flex items-center gap-2 text-lg font-bold text-theme-text">
          <Volume2 size={20} className="text-curi-pink" />
          Audio
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-theme-subtle/5 border border-theme-border">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
              mode === id ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
            }`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {currentAudio && (
        <div className="card p-2 flex items-center gap-2 text-xs">
          <Volume2 size={14} className="text-curi-green flex-shrink-0" />
          <span className="flex-1 truncate font-medium text-theme-text">{currentAudio.name}</span>
          <button
            type="button"
            onClick={() => {
              const src = currentAudio.dataUrl || currentAudio.url
              if (src) new Audio(src).play()
            }}
            className="p-1 rounded hover:bg-theme-subtle/10 text-theme-muted/60"
            title="Play"
          >
            <Play size={12} />
          </button>
        </div>
      )}

      {mode === 'voice' && (
        <div className="space-y-2">
          <p className="text-[10px] text-theme-muted/55 leading-snug">
            Generate a voiceover in any language and tonality. Uses ElevenLabs when configured.
          </p>
          <textarea
            className="input w-full text-xs h-20 resize-none"
            placeholder="Script for your voiceover…"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input text-xs py-1.5"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {TALKING_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <select
              className="input text-xs py-1.5"
              value={tonality}
              onChange={(e) => setTonality(e.target.value)}
            >
              {TALKING_TONALITIES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={synthesizeVoice}
            disabled={generating || !script.trim()}
            className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
            Generate & add voice
          </button>
        </div>
      )}

      {mode === 'music' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {AUDIO_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  category === cat.id ? 'bg-curi-pink text-white' : 'bg-theme-subtle/5 text-theme-muted/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {filteredClips.map((clip) => (
              <div
                key={clip.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-theme-border hover:border-curi-pink/30 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleClipPreview(clip)}
                  className="p-1.5 rounded-full bg-theme-subtle/10 text-curi-pink hover:bg-curi-pink/15 flex-shrink-0"
                >
                  {playingId === clip.id ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-theme-text truncate">{clip.name}</div>
                  <div className="text-[10px] text-theme-muted/50 capitalize">{clip.category}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddClip(clip)}
                  className="p-1.5 rounded-lg bg-curi-green/15 text-curi-green hover:bg-curi-green/25 flex-shrink-0"
                  title="Add to design"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-theme-muted/40">Royalty-free previews via Mixkit</p>
        </div>
      )}

      {mode === 'upload' && (
        <div className="space-y-2">
          <p className="text-[10px] text-theme-muted/55">
            Upload MP3, WAV, or M4A to attach to your creative (max 8 MB).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-secondary w-full text-xs py-3 flex items-center justify-center gap-2 border-dashed"
          >
            <Upload size={16} />
            Choose audio file
          </button>
        </div>
      )}
    </div>
  )
}
