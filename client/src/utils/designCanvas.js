import { BUILTIN_TEMPLATES, LAYOUT_TO_TEMPLATE } from '../constants/designTemplates'

const DIM_MAP = {
  '1080x1080': { width: 1080, height: 1080, label: '1080 x 1080' },
  '1080x1350': { width: 1080, height: 1350, label: '1080 x 1350' },
  '1080x1920': { width: 1080, height: 1920, label: '1080 x 1920' },
  '1920x1080': { width: 1920, height: 1080, label: '1920 x 1080' },
  '1200x628': { width: 1200, height: 628, label: '1200 x 628' },
}

export const parseDimensions = (design) => {
  const id = design?.dimensions?.id || design?.dimensionId || '1080x1080'
  return DIM_MAP[id] || DIM_MAP['1080x1080']
}

const defaultColors = (design) => design?.colorPalette || ['#FF6B9D', '#4DA8EE', '#1A2B48']

const buildDecorElements = (template, dims) => {
  if (!template?.decorElements?.length) return []
  return template.decorElements.map((el) => ({
    ...el,
    x: Math.round((el.x ?? 0) * dims.width),
    y: Math.round((el.y ?? 0) * dims.height),
    width: Math.round((el.width ?? 0.1) * dims.width),
    height: Math.round((el.height ?? 0.1) * dims.height),
    visible: true,
  }))
}

export const buildCanvasElements = (design, templateId) => {
  const dims = parseDimensions(design)
  const tid = templateId || LAYOUT_TO_TEMPLATE[design?.layout] || 'centered-hero'
  const template = BUILTIN_TEMPLATES.find(t => t.id === tid) || BUILTIN_TEMPLATES[0]
  const p = template.placements

  const px = (key, field, fallback) => {
    const v = p[key]?.[field]
    if (v == null) return fallback
    if (field === 'x' || field === 'y' || field === 'width') return Math.round(v * (field === 'width' ? dims.width : field === 'x' ? dims.width : dims.height))
    return v
  }

  const elements = [
    {
      id: 'badge',
      type: 'badge',
      text: design?.layout || 'centered',
      x: px('badge', 'x', 40),
      y: px('badge', 'y', 40),
      width: px('badge', 'width', 180),
      fontSize: 14,
      color: '#ffffff',
      visible: true,
    },
    {
      id: 'headline',
      type: 'text',
      text: design?.headline || 'Your Headline',
      x: px('headline', 'x', 48),
      y: px('headline', 'y', Math.round(dims.height * 0.35)),
      width: px('headline', 'width', dims.width - 96),
      fontSize: p.headline?.fontSize || 48,
      fontWeight: 800,
      color: '#ffffff',
      align: p.headline?.align || 'left',
      visible: true,
    },
    {
      id: 'subheadline',
      type: 'text',
      text: design?.subheadline || '',
      x: px('subheadline', 'x', 48),
      y: px('subheadline', 'y', Math.round(dims.height * 0.5)),
      width: px('subheadline', 'width', dims.width - 96),
      fontSize: p.subheadline?.fontSize || 20,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.85)',
      align: p.subheadline?.align || 'left',
      visible: Boolean(design?.subheadline),
    },
    {
      id: 'cta',
      type: 'button',
      text: design?.cta || 'Learn More',
      x: px('cta', 'x', 48),
      y: px('cta', 'y', Math.round(dims.height * 0.78)),
      width: px('cta', 'width', 220),
      fontSize: 14,
      fontWeight: 700,
      color: '#1A2B48',
      bgColor: '#ffffff',
      visible: Boolean(design?.cta),
    },
  ]
  const decor = buildDecorElements(template, dims)
  return decor.length ? [...decor, ...elements] : elements
}

export const designToCanvas = (design, templateId) => {
  const dims = parseDimensions(design)
  const colors = defaultColors(design)
  return {
    width: dims.width,
    height: dims.height,
    templateId: templateId || LAYOUT_TO_TEMPLATE[design?.layout] || 'centered-hero',
    background: {
      type: 'gradient',
      colors: [colors[0], colors[1] || colors[0]],
      angle: 135,
    },
    elements: buildCanvasElements(design, templateId),
  }
}

export const buildTemplatePreviewCanvas = (template, brandColors) => {
  const sample = template.sampleCopy || {}
  const colors = brandColors?.length ? brandColors : (template.previewColors || defaultColors({}))
  const design = {
    headline: sample.headline || 'Your Headline',
    subheadline: sample.subheadline || '',
    cta: sample.cta || 'Learn More',
    layout: sample.layout || 'centered',
    colorPalette: colors,
    dimensions: { id: template.recommendedDimension || '1080x1080' },
  }
  return buildPreviewCanvasFromDesign(design, template)
}

const buildPreviewCanvasFromDesign = (design, template) => {
  const canvas = designToCanvas(design, template.id)
  if (template.textOnLight) {
    canvas.elements = canvas.elements.map((el) => {
      if (el.type === 'text' || el.type === 'badge') {
        return { ...el, color: el.id === 'subheadline' ? 'rgba(26,43,72,0.7)' : '#1A2B48' }
      }
      if (el.type === 'button') return { ...el, bgColor: '#1A2B48', color: '#ffffff' }
      return el
    })
  }
  const decor = buildDecorElements(template, { width: canvas.width, height: canvas.height })
  if (decor.length) canvas.elements = [...decor, ...canvas.elements]
  return canvas
}

export const applyTemplateToCanvas = (canvas, templateId, customPlacements) => {
  const template = BUILTIN_TEMPLATES.find(t => t.id === templateId)
    || (customPlacements ? { placements: customPlacements } : null)
  if (!template) return canvas

  const { width, height } = canvas
  const elements = canvas.elements.map(el => {
    const p = template.placements[el.id]
    if (!p) return el
    return {
      ...el,
      x: Math.round((p.x ?? 0) * width),
      y: Math.round((p.y ?? 0) * height),
      width: p.width ? Math.round(p.width * width) : el.width,
      fontSize: p.fontSize ?? el.fontSize,
      align: p.align ?? el.align,
    }
  })

  return { ...canvas, templateId, elements }
}

export const canvasToDesignFields = (canvas) => {
  const byId = Object.fromEntries(canvas.elements.map(e => [e.id, e]))
  return {
    headline: byId.headline?.text || '',
    subheadline: byId.subheadline?.text || '',
    cta: byId.cta?.text || '',
    layout: byId.badge?.text || 'centered',
    colorPalette: canvas.background?.colors || ['#FF6B9D', '#4DA8EE'],
  }
}

export const syncCanvasTextFromDesign = (canvas, design) => ({
  ...canvas,
  elements: canvas.elements.map(el => {
    if (el.id === 'headline') return { ...el, text: design.headline ?? el.text }
    if (el.id === 'subheadline') return { ...el, text: design.subheadline ?? el.text, visible: Boolean(design.subheadline ?? el.text) }
    if (el.id === 'cta') return { ...el, text: design.cta ?? el.text, visible: Boolean(design.cta ?? el.text) }
    if (el.id === 'badge') return { ...el, text: design.layout ?? el.text }
    return el
  }),
})

const MIN_ELEMENT_SIZE = 24

export const getElementBounds = (el) => {
  const width = el.width || 200
  let height = el.height
  if (!height) {
    if (el.type === 'text' || el.type === 'badge') {
      const lines = String(el.text || '').split('\n').length
      height = Math.round((el.fontSize || 24) * Math.max(lines, 1) * 1.35)
    } else if (el.type === 'button') {
      height = Math.round((el.fontSize || 14) + 28)
    } else {
      height = width
    }
  }
  return { width, height }
}

export const canResizeElement = (el) => {
  if (!el || el.visible === false) return false
  return ['image', 'character', 'talking-character', 'shape', 'text', 'button', 'badge'].includes(el.type)
}

export const applyResizePatch = (el, handle, orig, dx, dy, canvasW, canvasH) => {
  let { x, y, width, height } = orig
  const min = MIN_ELEMENT_SIZE

  if (handle.includes('e')) width = Math.max(min, orig.width + dx)
  if (handle.includes('w')) {
    const nextW = Math.max(min, orig.width - dx)
    x = orig.x + (orig.width - nextW)
    width = nextW
  }
  if (handle.includes('s')) height = Math.max(min, orig.height + dy)
  if (handle.includes('n')) {
    const nextH = Math.max(min, orig.height - dy)
    y = orig.y + (orig.height - nextH)
    height = nextH
  }

  x = Math.round(Math.max(0, Math.min(canvasW - width, x)))
  y = Math.round(Math.max(0, Math.min(canvasH - height, y)))
  width = Math.round(Math.min(width, canvasW - x))
  height = Math.round(Math.min(height, canvasH - y))

  const patch = { x, y, width, height }

  if ((el.type === 'text' || el.type === 'badge') && orig.width > 0) {
    const ratio = width / orig.width
    patch.fontSize = Math.max(8, Math.round((el.fontSize || 24) * ratio))
  }
  if (el.type === 'button' && orig.width > 0) {
    const ratio = width / orig.width
    patch.fontSize = Math.max(8, Math.round((el.fontSize || 14) * ratio))
  }

  return patch
}

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const resizeHandleCursor = (handle) => ({
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
}[handle] || 'default')

export const resizeHandleStyle = (handle, size) => {
  const half = size / 2
  const base = { width: size, height: size, position: 'absolute' }
  switch (handle) {
    case 'nw': return { ...base, left: -half, top: -half }
    case 'n': return { ...base, left: '50%', top: -half, transform: 'translateX(-50%)' }
    case 'ne': return { ...base, right: -half, top: -half }
    case 'e': return { ...base, right: -half, top: '50%', transform: 'translateY(-50%)' }
    case 'se': return { ...base, right: -half, bottom: -half }
    case 's': return { ...base, left: '50%', bottom: -half, transform: 'translateX(-50%)' }
    case 'sw': return { ...base, left: -half, bottom: -half }
    case 'w': return { ...base, left: -half, top: '50%', transform: 'translateY(-50%)' }
    default: return base
  }
}
