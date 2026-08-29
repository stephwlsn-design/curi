import {
  BROWSER_VOICE_PITCH,
  BROWSER_VOICE_RATE,
  BROWSER_GENDER_PITCH,
} from '../constants/talkingCharacter'

const VOICE_TONALITY = {
  professional: 'professional',
  energetic: 'energetic',
  friendly: 'friendly',
  luxury: 'calm',
  corporate: 'professional',
  influencer: 'energetic',
}

export const voiceToTonality = (voice) => VOICE_TONALITY[String(voice || '').toLowerCase()] || 'professional'

export const buildSceneTimeline = (video) => {
  if (!video) return []
  const items = []
  if (video.hook) {
    items.push({
      label: 'Hook',
      script: video.hook,
      visual: video.hookVisual || 'Opening shot',
      duration: 3,
      stockMedia: video.hookStockMedia || null,
    })
  }
  for (const scene of video.scenes || []) {
    if (scene?.script || scene?.label) {
      items.push({
        label: scene.label || `Scene ${items.length + 1}`,
        script: scene.script || '',
        visual: scene.visual || '',
        duration: scene.duration || 5,
        stockMedia: scene.stockMedia || null,
      })
    }
  }
  if (video.cta) {
    items.push({
      label: 'CTA',
      script: video.cta,
      visual: 'Call to action',
      duration: 4,
      stockMedia: video.ctaStockMedia || null,
    })
  }
  const outro = String(video.outro || '').trim()
  const cta = String(video.cta || '').trim()
  if (outro && outro !== cta) {
    items.push({ label: 'Outro', script: video.outro, visual: 'End card', duration: 3 })
  }
  return items.filter((s) => s.script?.trim())
}

const pickBrowserVoice = (language, gender) => {
  const voices = window.speechSynthesis?.getVoices?.() || []
  if (!voices.length) return null
  const lang = language?.includes('-') ? language : `${language || 'en'}-US`
  const langPrefix = lang.split('-')[0]
  const langMatches = voices.filter((v) => v.lang?.startsWith(langPrefix))
  const pool = langMatches.length ? langMatches : voices

  if (gender === 'male') {
    return pool.find((v) => /male|david|james|daniel|mark|guy|ryan|thomas/i.test(`${v.name} ${v.voiceURI}`))
      || pool.find((v) => !/female|samantha|victoria|zira|susan|karen/i.test(`${v.name} ${v.voiceURI}`))
  }
  return pool.find((v) => /female|samantha|victoria|zira|susan|karen|aria|jenny/i.test(`${v.name} ${v.voiceURI}`))
    || pool[0]
}

export const stopSpeech = () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

export const speakScene = ({
  text,
  tonality = 'professional',
  gender = 'female',
  language = 'en-US',
}) => new Promise((resolve, reject) => {
  if (!text?.trim()) {
    resolve()
    return
  }
  if (!window.speechSynthesis) {
    reject(new Error('Speech preview is not supported in this browser'))
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language
  utterance.rate = BROWSER_VOICE_RATE[tonality] ?? 1
  utterance.pitch = (BROWSER_GENDER_PITCH[gender] ?? 1) * (BROWSER_VOICE_PITCH[tonality] ?? 1)
  const voice = pickBrowserVoice(language, gender)
  if (voice) utterance.voice = voice

  let settled = false
  const finish = (fn) => {
    if (settled) return
    settled = true
    fn()
  }

  utterance.onend = () => finish(resolve)
  utterance.onerror = () => finish(() => reject(new Error('Could not play voice preview')))

  window.speechSynthesis.speak(utterance)

  // Safari sometimes skips onend — cap wait by rough duration
  const wordCount = text.trim().split(/\s+/).length
  const fallbackMs = Math.max(2500, Math.min(wordCount * 420, 20000))
  setTimeout(() => finish(resolve), fallbackMs)
})

export const VIDEO_TYPE_GRADIENT = {
  talking_head: 'from-curi-navy via-curi-blue to-curi-navy',
  ai_avatar: 'from-purple-900 via-curi-blue to-curi-navy',
  motion_graphics: 'from-curi-navy via-curi-blue to-indigo-900',
  product_showcase: 'from-curi-navy to-curi-green/80',
  animated_explainer: 'from-indigo-900 via-curi-blue to-curi-pink/70',
  ugc_style: 'from-curi-pink/80 via-orange-500/70 to-curi-yellow/60',
  broll_storytelling: 'from-slate-900 via-curi-navy to-curi-blue',
  slideshow: 'from-curi-navy to-curi-blue',
  podcast_clip: 'from-zinc-900 via-curi-navy to-purple-900',
}
