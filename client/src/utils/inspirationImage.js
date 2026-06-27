/** Resize/compress inspiration images so uploads always include an analysis preview. */
export async function compressImageForInspiration(file, { maxDim = 1600, quality = 0.82, maxBytes = 750_000 } = {}) {
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
