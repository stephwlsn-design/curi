import {
  BROWSER_VOICE_PITCH,
  BROWSER_VOICE_RATE,
} from '../constants/talkingCharacter'

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
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

  await new Promise((resolve, reject) => {
    audio.onloadedmetadata = resolve
    audio.onerror = reject
  })

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
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

  const drawFrame = (scale = 1) => {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    const baseW = width * 0.72
    const dw = baseW * scale
    const dh = (img.height / img.width) * dw
    const dx = (width - dw) / 2
    const dy = (height - dh) / 2
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
        setTimeout(() => recorder.stop(), 250)
        return
      }
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i += 1) sum += dataArray[i]
      const avg = sum / dataArray.length
      const scale = 1 + Math.min(avg / 140, 1) * 0.1
      drawFrame(scale)
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

export function previewWithBrowserVoice({ text, language, tonality }) {
  if (!window.speechSynthesis) {
    throw new Error('Browser speech is not supported in this environment')
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const lang = language?.includes('-') ? language : `${language || 'en'}-US`
  utterance.lang = lang
  utterance.rate = BROWSER_VOICE_RATE[tonality] ?? 1
  utterance.pitch = BROWSER_VOICE_PITCH[tonality] ?? 1
  window.speechSynthesis.speak(utterance)
}
