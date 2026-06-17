export const TALKING_LANGUAGES = [
  { id: 'en', label: 'English', bcp47: 'en-US' },
  { id: 'es', label: 'Spanish', bcp47: 'es-ES' },
  { id: 'fr', label: 'French', bcp47: 'fr-FR' },
  { id: 'de', label: 'German', bcp47: 'de-DE' },
  { id: 'pt', label: 'Portuguese', bcp47: 'pt-BR' },
  { id: 'it', label: 'Italian', bcp47: 'it-IT' },
  { id: 'nl', label: 'Dutch', bcp47: 'nl-NL' },
  { id: 'ar', label: 'Arabic', bcp47: 'ar-SA' },
  { id: 'zh', label: 'Chinese', bcp47: 'zh-CN' },
  { id: 'ja', label: 'Japanese', bcp47: 'ja-JP' },
  { id: 'ko', label: 'Korean', bcp47: 'ko-KR' },
  { id: 'hi', label: 'Hindi', bcp47: 'hi-IN' },
  { id: 'sw', label: 'Swahili', bcp47: 'sw-KE' },
  { id: 'yo', label: 'Yoruba', bcp47: 'yo-NG' },
  { id: 'zu', label: 'Zulu', bcp47: 'zu-ZA' },
]

export const TALKING_TONALITIES = [
  { id: 'warm', label: 'Warm', description: 'Soft and welcoming' },
  { id: 'professional', label: 'Professional', description: 'Clear and authoritative' },
  { id: 'energetic', label: 'Energetic', description: 'Upbeat and lively' },
  { id: 'calm', label: 'Calm', description: 'Relaxed and steady' },
  { id: 'friendly', label: 'Friendly', description: 'Approachable and natural' },
  { id: 'bold', label: 'Bold', description: 'Confident and strong' },
  { id: 'playful', label: 'Playful', description: 'Fun and expressive' },
]

export const BROWSER_VOICE_PITCH = {
  warm: 1.05,
  professional: 0.95,
  energetic: 1.15,
  calm: 0.9,
  friendly: 1.0,
  bold: 0.92,
  playful: 1.2,
}

export const BROWSER_VOICE_RATE = {
  warm: 0.95,
  professional: 0.9,
  energetic: 1.1,
  calm: 0.85,
  friendly: 1.0,
  bold: 1.05,
  playful: 1.15,
}
