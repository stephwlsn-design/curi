import clips from '../../../shared/designAudioClips.json'

export const DESIGN_AUDIO_CLIPS = clips

export const AUDIO_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'upbeat', label: 'Upbeat' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'calm', label: 'Calm' },
  { id: 'sfx', label: 'Sound FX' },
]

export const searchAudioClips = (query, category = 'all') => {
  const q = query.trim().toLowerCase()
  return DESIGN_AUDIO_CLIPS.filter((clip) => {
    if (category !== 'all' && clip.category !== category) return false
    if (!q) return true
    const haystack = [clip.name, clip.category, ...(clip.tags || [])].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

export const applyAudioToCanvas = (canvas, audio) => ({
  ...canvas,
  audio: {
    id: audio.id || `audio-${Date.now()}`,
    name: audio.name || 'Audio track',
    type: audio.type || 'music',
    url: audio.url,
    dataUrl: audio.dataUrl || null,
    script: audio.script || '',
    language: audio.language || null,
    tonality: audio.tonality || null,
    provider: audio.provider || null,
    volume: audio.volume ?? 1,
    loop: audio.loop ?? false,
  },
})

export const removeAudioFromCanvas = (canvas) => {
  const next = { ...canvas }
  delete next.audio
  return next
}

export const getCanvasAudioUrl = (audio) => audio?.dataUrl || audio?.url || null
