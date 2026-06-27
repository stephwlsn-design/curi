/** Resize/compress inspiration images so uploads always include an analysis preview. */
export async function compressImageForInspiration(file, { maxDim = 1200, quality = 0.8, maxBytes = 480_000 } = {}) {
  if (!file?.type?.startsWith('image/')) return file
  if (file.size <= maxBytes && file.type === 'image/jpeg') return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file)
          return
        }
        const name = file.name.replace(/\.\w+$/, '') || 'inspiration'
        resolve(new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

export async function blobOrUrlToDataUrl(ref) {
  if (!ref || typeof ref !== 'string') return null
  if (ref.startsWith('data:')) return ref
  if (!ref.startsWith('blob:') && !ref.startsWith('http')) return null
  try {
    const res = await fetch(ref)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Ensure design idea payload includes previewDataUrl for server-side aesthetic analysis. */
export async function enrichDesignIdeaWithPreview(designIdea) {
  if (!designIdea) return designIdea
  if (designIdea.previewDataUrl) return designIdea
  const ref = designIdea.imageUrl || designIdea.previewDataUrl
  const previewDataUrl = await blobOrUrlToDataUrl(ref)
  if (!previewDataUrl) return designIdea
  return { ...designIdea, previewDataUrl }
}

export const DEFAULT_BRAND_PALETTE = ['#FF6B9D', '#4DA8EE', '#1A2B48']

const hexLuminance = (hex) => {
  const m = String(hex || '').match(/#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (!m) return 128
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

const rgbToHex = (r, g, b) => (
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
)

const quantizeChannel = (v) => Math.round(v / 16) * 16

/** Detect server-side brand-color fallback saved as a fake analyzed spec. */
export const isWeakInspirationSpec = (spec) => {
  if (!spec) return true
  if (spec.source === 'brand-fallback') return true
  if (spec.source === 'local-extract' || spec.source === 'gemini') return false
  const bg = (spec.backgroundColor || spec.colorPalette?.[0] || '').toLowerCase()
  const isDefaultPink = bg === '#ff6b9d' || bg === DEFAULT_BRAND_PALETTE[0].toLowerCase()
  const emptyDecor = !spec.decorElements?.length && !spec.iconElements?.length
  return isDefaultPink && emptyDecor && (spec.layout === 'centered' || !spec.layout)
}

/** Sample pixels from a preview image — reliable when Gemini times out on Vercel. */
export async function extractLocalAestheticSpec(previewDataUrl) {
  if (!previewDataUrl?.startsWith('data:')) return null

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = img.width
        const h = img.height
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, w, h).data

        const sampleRect = (x0, y0, rw, rh) => {
          const x1 = Math.min(w, x0 + rw)
          const y1 = Math.min(h, y0 + rh)
          const buckets = new Map()
          for (let y = y0; y < y1; y += 3) {
            for (let x = x0; x < x1; x += 3) {
              const i = (y * w + x) * 4
              if (data[i + 3] < 200) continue
              const key = `${quantizeChannel(data[i])},${quantizeChannel(data[i + 1])},${quantizeChannel(data[i + 2])}`
              buckets.set(key, (buckets.get(key) || 0) + 1)
            }
          }
          let best = null
          let bestCount = 0
          buckets.forEach((count, key) => {
            if (count > bestCount) {
              bestCount = count
              best = key
            }
          })
          if (!best) return '#1A2B48'
          const [r, g, b] = best.split(',').map(Number)
          return rgbToHex(r, g, b)
        }

        const regionVariance = (x0, y0, rw, rh) => {
          const x1 = Math.min(w, x0 + rw)
          const y1 = Math.min(h, y0 + rh)
          let sum = 0
          let sumSq = 0
          let n = 0
          for (let y = y0; y < y1; y += 4) {
            for (let x = x0; x < x1; x += 4) {
              const i = (y * w + x) * 4
              if (data[i + 3] < 200) continue
              const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
              sum += lum
              sumSq += lum * lum
              n += 1
            }
          }
          if (n < 2) return 0
          const mean = sum / n
          return sumSq / n - mean * mean
        }

        const leftBg = sampleRect(0, 0, Math.floor(w * 0.48), h)
        const rightBg = sampleRect(Math.floor(w * 0.52), 0, Math.floor(w * 0.48), h)
        const topBg = sampleRect(0, 0, w, Math.floor(h * 0.15))
        const candidates = [leftBg, rightBg, topBg]
        const backgroundColor = candidates.reduce((darkest, hex) => (
          hexLuminance(hex) < hexLuminance(darkest) ? hex : darkest
        ), candidates[0])

        const accentCandidates = candidates.filter((c) => c !== backgroundColor)
        const secondaryBackgroundColor = accentCandidates[0] || backgroundColor
        const accent = accentCandidates[1] || secondaryBackgroundColor

        const leftVar = regionVariance(0, Math.floor(h * 0.12), Math.floor(w * 0.46), Math.floor(h * 0.76))
        const rightVar = regionVariance(Math.floor(w * 0.5), Math.floor(h * 0.12), Math.floor(w * 0.46), Math.floor(h * 0.76))
        const layout = rightVar > leftVar * 1.25 && rightVar > 400 ? 'split' : 'centered'

        const isDark = hexLuminance(backgroundColor) < 110
        const textColor = isDark ? '#ffffff' : '#1A2B48'
        const subtextColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(26,43,72,0.75)'

        const decorElements = []
        if (layout === 'split') {
          const fill = isDark ? 'rgba(255,255,255,0.12)' : `${accent}55`
          decorElements.push(
            { shape: 'circle', x: 0.58, y: 0.22, width: 0.14, height: 0.14, fill },
            { shape: 'circle', x: 0.7, y: 0.34, width: 0.16, height: 0.16, fill },
            { shape: 'circle', x: 0.55, y: 0.46, width: 0.12, height: 0.12, fill },
            { shape: 'circle', x: 0.68, y: 0.52, width: 0.13, height: 0.13, fill },
            { shape: 'rect', x: 0, y: 0, width: 0.52, height: 1, fill: `${backgroundColor}00`, borderRadius: 0 },
          )
        } else {
          decorElements.push(
            { shape: 'rect', x: 0, y: 0, width: 1, height: 0.05, fill: accent, borderRadius: 0 },
            { shape: 'circle', x: 0.84, y: 0.08, width: 0.12, height: 0.12, fill: `${secondaryBackgroundColor}66` },
          )
        }

        const placements = layout === 'split'
          ? {
            headline: { x: 0.06, y: 0.28, width: 0.46, align: 'left', fontSize: 44 },
            subheadline: { x: 0.06, y: 0.5, width: 0.44, align: 'left', fontSize: 20 },
            cta: { x: 0.06, y: 0.76, width: 0.3, fontSize: 14 },
          }
          : {
            headline: { x: 0.08, y: 0.32, width: 0.84, align: 'center', fontSize: 48 },
            subheadline: { x: 0.1, y: 0.48, width: 0.8, align: 'center', fontSize: 22 },
            cta: { x: 0.32, y: 0.72, width: 0.36, fontSize: 14 },
          }

        resolve({
          colorPalette: [backgroundColor, secondaryBackgroundColor, accent].filter(Boolean),
          backgroundColor,
          secondaryBackgroundColor,
          layout,
          backgroundMode: isDark ? 'solid' : 'aesthetic',
          textColor,
          subtextColor,
          ctaBackground: isDark ? '#ffffff' : accent,
          ctaTextColor: isDark ? backgroundColor : '#ffffff',
          overlayOpacity: isDark ? 0 : 0.08,
          gradientAngle: 135,
          decorElements,
          iconElements: [],
          placements,
          aestheticOnly: true,
          inspirationAnalyzed: true,
          source: 'local-extract',
          mood: isDark ? 'corporate' : 'bold',
        })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = previewDataUrl
  })
}

/** Prefer Gemini details but keep local colors/layout when AI failed or returned generic brand palette. */
export const mergeInspirationSpecs = (localSpec, aiSpec) => {
  if (!localSpec) return aiSpec
  if (!aiSpec || isWeakInspirationSpec(aiSpec)) return localSpec
  if (aiSpec.source === 'gemini' || (!isWeakInspirationSpec(aiSpec) && aiSpec.decorElements?.length)) {
    return {
      ...localSpec,
      ...aiSpec,
      colorPalette: aiSpec.colorPalette?.length ? aiSpec.colorPalette : localSpec.colorPalette,
      backgroundColor: aiSpec.backgroundColor || localSpec.backgroundColor,
      secondaryBackgroundColor: aiSpec.secondaryBackgroundColor || localSpec.secondaryBackgroundColor,
      layout: aiSpec.layout || localSpec.layout,
      decorElements: aiSpec.decorElements?.length ? aiSpec.decorElements : localSpec.decorElements,
      iconElements: aiSpec.iconElements?.length ? aiSpec.iconElements : localSpec.iconElements,
      placements: aiSpec.placements || localSpec.placements,
      source: 'gemini',
      inspirationAnalyzed: true,
      aestheticOnly: true,
    }
  }
  return localSpec
}
