import { BUILTIN_TEMPLATES } from '../constants/designTemplates'
import { buildGraphicCanvas, getGraphicTemplate } from './graphicCanvas'
import { designToCanvas } from './designCanvas'
import {
  applyPexelsPhotoToCanvas,
  buildCanvasFromPexelsVideo,
} from './pexelsCanvas'

let draftCounter = 0

const nextDraftId = () => `draft-${Date.now()}-${++draftCounter}`

export function buildLocalDesign({
  templateId = 'centered-hero',
  customTemplate,
  brandColors,
  prompt = '',
}) {
  const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline'
  const subheadline = prompt.slice(0, 120) || ''
  const cta = 'Learn More'
  const badge = ''

  if (customTemplate?.canvasLayout) {
    const layout = customTemplate.canvasLayout
    return {
      _local: true,
      _id: nextDraftId(),
      name: customTemplate.name || 'Custom Template',
      headline,
      subheadline,
      cta,
      layout: 'custom',
      dimensions: { id: customTemplate.dimensionId || '1080x1080' },
      colorPalette: brandColors || [],
      canvasLayout: layout,
      templateId: layout.templateId,
    }
  }

  const graphic = getGraphicTemplate(templateId)
  const builtin = graphic || BUILTIN_TEMPLATES.find(t => t.id === templateId)
  if (!builtin) return null

  const sample = builtin.sampleCopy || {}
  const copy = {
    headline: headline || sample.headline || 'Your Headline',
    subheadline: subheadline || sample.subheadline || '',
    cta: sample.cta || cta,
    badge: sample.badge || badge,
    colorPalette: brandColors,
  }
  const dimensionId = builtin.recommendedDimension || '1080x1080'

  const canvasLayout = graphic
    ? buildGraphicCanvas(graphic, copy, dimensionId)
    : designToCanvas({
      headline: copy.headline,
      subheadline: copy.subheadline,
      cta: copy.cta,
      layout: builtin.layout || 'centered',
      dimensions: { id: dimensionId },
      colorPalette: brandColors || [],
    }, templateId)

  return {
    _local: true,
    _id: nextDraftId(),
    headline: copy.headline,
    subheadline: copy.subheadline,
    cta: copy.cta,
    layout: graphic?.category || builtin.layout || 'centered',
    dimensions: { id: dimensionId },
    colorPalette: brandColors || [],
    name: graphic?.name || builtin.name || 'New Design',
    canvasLayout,
    templateId: graphic?.id || templateId,
  }
}

export function applyLocalPexelsPhoto(design, item, useAs = 'background') {
  const canvasLayout = applyPexelsPhotoToCanvas(design.canvasLayout, item.url, useAs)
  return {
    ...design,
    _local: true,
    canvasLayout,
    pexelsAttribution: item.photographer,
  }
}

export function applyLocalPexelsVideo(design, item) {
  const dimensionId = design.dimensions?.id || '1080x1080'
  const canvasLayout = buildCanvasFromPexelsVideo({
    posterUrl: item.thumbnailUrl,
    videoUrl: item.url,
    dimensionId,
    headline: design.headline || 'Video Design',
  })
  return {
    ...design,
    _local: true,
    canvasLayout,
    name: design.name || 'Video Design',
  }
}

export function isDraftDesign(design) {
  if (!design) return false
  if (design._local) return true
  const id = String(design._id || '')
  return !id || id.startsWith('draft-')
}
