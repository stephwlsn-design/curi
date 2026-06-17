import {
  BROWSER_VOICE_PITCH,
  BROWSER_VOICE_RATE,
  BROWSER_GENDER_PITCH,
} from '../constants/talkingCharacter'

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  if (src.startsWith('http://') || src.startsWith('https://')) {
    img.crossOrigin = 'anonymous'
  }
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('Could not load character image'))
  img.src = src
})

const waitForAudio = (audio) => new Promise((resolve, reject) => {
  if (audio.readyState >= 3) {
    resolve()
    return
  }
  const onReady = () => {
    cleanup()
    resolve()
  }
  const onError = () => {
    cleanup()
    reject(new Error('Could not load speech audio'))
  }
  const cleanup = () => {
    audio.removeEventListener('canplaythrough', onReady)
    audio.removeEventListener('error', onError)
  }
  audio.addEventListener('canplaythrough', onReady, { once: true })
  audio.addEventListener('error', onError, { once: true })
  audio.load()
})

const pickRecorderMime = () => {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
}

/**
 * Renders a simple talking-head style clip: image bounces with speech audio.
 */
export async function createTalkingVideo({
  imageUrl,
  audioBlob,
  width = 720,
  height = 720,
  backgroundColor = '#FFB6C8',
}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  const img = await loadImage(imageUrl)
  const audioUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(audioUrl)

  await waitForAudio(audio)

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
  const source = audioCtx.createMediaElementSource(audio)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  const dest = audioCtx.createMediaStreamDestination()
  source.connect(analyser)
  analyser.connect(dest)
  analyser.connect(audioCtx.destination)

  const canvasStream = canvas.captureStream(30)
  dest.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track))

  const mimeType = pickRecorderMime()
  const chunks = []
  const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 })
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }

  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  const drawFrame = (scale = 1, jawDrop = 0) => {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    const baseW = width * 0.72
    const dw = baseW * scale
    const dh = (img.height / img.width) * dw
    const dx = (width - dw) / 2
    const dy = (height - dh) / 2 + jawDrop * 0.35
    ctx.drawImage(img, dx, dy, dw, dh)
  }

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const videoBlob = new Blob(chunks, { type: mimeType })
      audioCtx.close()
      URL.revokeObjectURL(audioUrl)
      resolve({
        videoBlob,
        videoUrl: URL.createObjectURL(videoBlob),
        duration: audio.duration,
        mimeType,
      })
    }
    recorder.onerror = reject

    let rafId
    const animate = () => {
      if (audio.ended) {
        cancelAnimationFrame(rafId)
        drawFrame(1)
        setTimeout(() => recorder.stop(), 350)
        return
      }
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i += 1) sum += dataArray[i]
      const avg = sum / dataArray.length
      const scale = 1 + Math.min(avg / 100, 1) * 0.18
      const jawDrop = Math.min(avg / 120, 1) * 12
      drawFrame(scale, jawDrop)
      rafId = requestAnimationFrame(animate)
    }

    recorder.start(100)
    drawFrame(1)
    audio.play().then(() => {
      animate()
    }).catch(reject)
  })
}

export function base64ToBlob(base64, mimeType) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

export async function mediaUrlToDataUrl(url, maxBytes = 8 * 1024 * 1024) {
  if (!url) return null
  if (url.startsWith('data:')) return url
  const blob = await fetch(url).then((r) => r.blob())
  if (blob.size > maxBytes) return url
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Resize portrait before lip-sync upload (smaller payload, faster processing).
 */
export async function compressImageForLipSync(url, maxDim = 768) {
  const dataUrl = url.startsWith('data:') ? url : await mediaUrlToDataUrl(url)
  if (!dataUrl) return url

  return new Promise((resolve, reject) => {
    const img = new Image()
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => reject(new Error('Could not read uploaded image'))
    img.src = dataUrl
  })
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
  if (gender === 'female') {
    return pool.find((v) => /female|samantha|victoria|zira|susan|karen|aria|jenny/i.test(`${v.name} ${v.voiceURI}`))
  }
  return pool[0]
}

export function previewWithBrowserVoice({ text, language, tonality, gender = 'female' }) {
  if (!window.speechSynthesis) {
    throw new Error('Browser speech is not supported in this environment')
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const lang = language?.includes('-') ? language : `${language || 'en'}-US`
  utterance.lang = lang
  utterance.rate = BROWSER_VOICE_RATE[tonality] ?? 1
  const genderPitch = BROWSER_GENDER_PITCH[gender] ?? 1
  const tonePitch = BROWSER_VOICE_PITCH[tonality] ?? 1
  utterance.pitch = genderPitch * tonePitch
  const voice = pickBrowserVoice(lang, gender)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function downloadVideoBlob(remoteUrl) {
  const blob = await fetch(remoteUrl).then((r) => {
    if (!r.ok) throw new Error('Could not download lip-sync video')
    return r.blob()
  })
  return {
    videoBlob: blob,
    videoUrl: URL.createObjectURL(blob),
  }
}

/**
 * Real lip-sync via SadTalker (server). Falls back to simple bounce animation if unavailable.
 */
const lipSyncErrorFromResponse = (data, status) => {
  const err = new Error(data?.error || data?.hint || 'Lip-sync did not return a video')
  err.code = data?.code
  err.hint = data?.hint
  err.status = status
  return err
}

export async function requestLipSyncVideo(API, { imageDataUrl, audioDataUrl, portrait = true, onProgress }) {
  onProgress?.('Uploading to lip-sync engine…')
  let data
  try {
    ({ data } = await API.post('/design/character/lipsync', {
      imageDataUrl,
      audioDataUrl,
      portrait,
    }, { timeout: 120000 }))
  } catch (axiosErr) {
    const payload = axiosErr.response?.data
    if (payload?.error || payload?.code) {
      throw lipSyncErrorFromResponse(payload, axiosErr.response?.status)
    }
    throw axiosErr
  }

  if (data.videoUrl) return data

  if (data.status === 'processing' && data.requestId) {
    onProgress?.('Generating lip-sync (mouth matching audio)…')
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(3000)
      onProgress?.(`Lip-sync in progress… (${Math.min(attempt + 1, 60) * 3}s)`)
      try {
        const poll = await API.get(`/design/character/lipsync/${data.requestId}`)
        if (poll.data?.videoUrl) return poll.data
        if (poll.data?.error) throw lipSyncErrorFromResponse(poll.data, poll.status)
      } catch (pollErr) {
        const payload = pollErr.response?.data
        if (payload?.error || payload?.code) {
          throw lipSyncErrorFromResponse(payload, pollErr.response?.status)
        }
        throw pollErr
      }
    }
    throw new Error('Lip-sync is still processing — wait a moment and try again')
  }

  throw lipSyncErrorFromResponse(data, 502)
}
