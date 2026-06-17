/** Apply extracted decor shapes and icon markers from inspiration analysis */

export const applySpecDecor = (canvas, spec) => {
  if (!spec) return canvas
  const { width, height } = canvas
  let z = 1
  const decor = (spec.decorElements || []).map((el, i) => ({
    id: `inspo-decor-${i}`,
    type: 'shape',
    x: Math.round((el.x ?? 0) * width),
    y: Math.round((el.y ?? 0) * height),
    width: Math.round((el.width ?? 0.08) * width),
    height: Math.round((el.height ?? 0.04) * height),
    fill: el.fill || el.color || 'rgba(255,255,255,0.18)',
    borderRadius: el.shape === 'circle' ? 9999 : (el.borderRadius ?? 4),
    visible: el.visible !== false,
    zIndex: z++,
  }))

  const icons = (spec.iconElements || []).map((el, i) => {
    const size = el.size || 36
    return {
      id: `inspo-icon-${i}`,
      type: 'icon',
      symbol: el.emoji || el.symbol || el.icon || '●',
      x: Math.round((el.x ?? 0) * width),
      y: Math.round((el.y ?? 0) * height),
      size,
      width: size,
      height: size,
      color: el.color || '#ffffff',
      visible: el.visible !== false,
      zIndex: z++,
    }
  })

  if (!decor.length && !icons.length) return canvas
  return { ...canvas, elements: [...decor, ...icons, ...canvas.elements] }
}

export const applyInspirationSpec = (canvas, spec) => {
  if (!spec) return canvas
  let next = canvas
  if (spec.placements) {
    const { width, height } = next
    next = {
      ...next,
      elements: next.elements.map((el) => {
        const p = spec.placements[el.id]
        if (!p) return el
        const patch = {}
        if (p.x != null) patch.x = Math.round(p.x * width)
        if (p.y != null) patch.y = Math.round(p.y * height)
        if (p.width != null) patch.width = Math.round(p.width * width)
        if (p.fontSize != null) patch.fontSize = p.fontSize
        if (p.align) patch.align = p.align
        if (el.id === 'headline' || el.id === 'subheadline') {
          patch.color = spec.textColor || el.color
          if (el.id === 'subheadline') patch.color = spec.subtextColor || patch.color
        }
        if (el.id === 'cta') {
          patch.bgColor = spec.ctaBackground || el.bgColor
          patch.color = spec.ctaTextColor || el.color
        }
        return { ...el, ...patch }
      }),
    }
  }
  return applySpecDecor(next, spec)
}

/** Finished creative uploaded by user — use as full canvas background */
export const buildOwnDesignCanvas = ({
  imageUrl,
  name = 'My Design',
  dimensionId = '1080x1080',
  caption = '',
}) => {
  const dims = {
    '1080x1080': { width: 1080, height: 1080 },
    '1080x1350': { width: 1080, height: 1350 },
    '1080x1920': { width: 1080, height: 1920 },
    '1920x1080': { width: 1920, height: 1080 },
    '1200x628': { width: 1200, height: 628 },
  }[dimensionId] || { width: 1080, height: 1080 }

  const elements = caption.trim()
    ? [{
      id: 'caption',
      type: 'text',
      text: caption.trim(),
      x: 48,
      y: dims.height - 120,
      width: dims.width - 96,
      fontSize: 22,
      fontWeight: 600,
      color: '#ffffff',
      align: 'center',
      visible: true,
      zIndex: 5,
    }]
    : []

  return {
    width: dims.width,
    height: dims.height,
    templateId: 'own-upload',
    background: {
      type: 'image',
      url: imageUrl,
      overlay: 'rgba(0,0,0,0)',
    },
    elements,
    ownUpload: true,
    designIdeaBased: false,
  }
}
