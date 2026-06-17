import { designToCanvas } from './designCanvas'
import { LAYOUT_TO_TEMPLATE } from '../constants/designTemplates'
import { buildAestheticBackground } from './aestheticBackground'
import { applySpecTypography } from './inspirationTypography'
import { applyInspirationSpec } from './inspirationSpec'
import { getPostFormat } from '../constants/postFormats'

const LAYOUT_TEMPLATE_MAP = {
  centered: 'centered-hero',
  split: 'split-left',
  grid: 'bottom-stack',
  hero: 'centered-hero',
  minimal: 'minimal-top',
}

let draftCounter = 0
const nextDraftId = () => `draft-${Date.now()}-${++draftCounter}`

const applySpecPlacements = (canvas, spec) => {
  if (!spec?.placements) return canvas
  const { width, height } = canvas
  const elements = canvas.elements.map((el) => {
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
  })
  return { ...canvas, elements }
}

export const buildCanvasWithDesignIdea = (design, ideaContext, dimensionId = '1080x1080', templateId) => {
  const resolvedTemplate = templateId
    || (ideaContext?.spec?.layout
      ? (LAYOUT_TEMPLATE_MAP[ideaContext.spec.layout] || 'centered-hero')
      : (LAYOUT_TO_TEMPLATE[design?.layout] || 'centered-hero'))

  const canvas = designToCanvas({ ...design, dimensions: { id: dimensionId } }, resolvedTemplate)
  if (!ideaContext?.imageUrl && !ideaContext?.spec?.colorPalette) return canvas

  canvas.background = buildAestheticBackground(ideaContext.spec, ideaContext.imageUrl)
  canvas.referenceImageUrl = ideaContext.imageUrl
  canvas.designIdeaBased = true
  canvas.aestheticOnly = true

  if (ideaContext.spec) {
    const styled = applyInspirationSpec(canvas, ideaContext.spec)
    return applySpecTypography(styled, ideaContext.spec)
  }
  return canvas
}

export const buildDesignFromInspiration = ({
  designIdea,
  ideaContext,
  brandColors,
  prompt = '',
  dimensionId = '1080x1080',
  postFormat = 'social_post',
  slideIndex = 1,
  slideTotal = 1,
}) => {
  const format = getPostFormat(postFormat)
  const spec = ideaContext?.spec || designIdea?.analyzedSpec
  const imageUrl = ideaContext?.imageUrl || designIdea?.imageUrl
  const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline'
  const subheadline = prompt.slice(0, 120) || ''
  const palette = spec?.colorPalette || brandColors || ['#FF6B9D', '#4DA8EE', '#1A2B48']
  const templateId = format.templateId

  const design = {
    headline: postFormat === 'carousel' && slideTotal > 1
      ? `${headline} (${slideIndex}/${slideTotal})`
      : headline,
    subheadline,
    cta: 'Learn More',
    layout: spec?.layout || format.id,
    dimensions: { id: dimensionId },
    colorPalette: palette,
    name: `${format.label}${slideTotal > 1 ? ` — Slide ${slideIndex}` : ''}`,
    referenceImageUrl: imageUrl,
    designIdeaApplied: true,
    postFormat: format.id,
    creativeType: format.creativeType,
    compositionNotes: ideaContext?.direction || designIdea?.analyzedDirection || '',
  }

  const context = {
    imageUrl,
    spec,
    direction: ideaContext?.direction || designIdea?.analyzedDirection,
  }

  const canvasLayout = (imageUrl || spec)
    ? buildCanvasWithDesignIdea(design, context, dimensionId, templateId)
    : designToCanvas(design, templateId)

  if (postFormat === 'carousel' && slideTotal > 1) {
    const badge = canvasLayout.elements.find((e) => e.id === 'badge')
    if (badge) {
      canvasLayout.elements = canvasLayout.elements.map((el) => (
        el.id === 'badge' ? { ...el, text: `${slideIndex} / ${slideTotal}` } : el
      ))
    }
  }

  return {
    _local: true,
    _id: nextDraftId(),
    ...design,
    canvasLayout,
    templateId: canvasLayout.templateId || templateId,
    designIdea: {
      notes: designIdea?.notes,
      imageUrl,
      referenceImageUrl: imageUrl,
    },
  }
}

export const buildCarouselFromInspiration = (opts) => {
  const format = getPostFormat(opts.postFormat || 'carousel')
  const count = Math.min(Math.max(opts.slideCount || format.defaultSlideCount || 5, 2), 10)
  return Array.from({ length: count }, (_, i) => buildDesignFromInspiration({
    ...opts,
    postFormat: 'carousel',
    slideIndex: i + 1,
    slideTotal: count,
  }))
}
