import { designToCanvas } from './designCanvas'
import { LAYOUT_TO_TEMPLATE } from '../constants/designTemplates'

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

export const buildCanvasWithDesignIdea = (design, ideaContext, dimensionId = '1080x1080') => {
  const templateId = ideaContext?.spec?.layout
    ? (LAYOUT_TEMPLATE_MAP[ideaContext.spec.layout] || 'centered-hero')
    : (LAYOUT_TO_TEMPLATE[design?.layout] || 'centered-hero')

  const canvas = designToCanvas({ ...design, dimensions: { id: dimensionId } }, templateId)
  if (!ideaContext?.imageUrl) return canvas

  const opacity = ideaContext.spec?.overlayOpacity ?? 0.35
  canvas.background = {
    type: 'image',
    url: ideaContext.imageUrl,
    overlay: `rgba(0,0,0,${opacity})`,
  }
  canvas.referenceImageUrl = ideaContext.imageUrl
  canvas.designIdeaBased = true

  if (ideaContext.spec) {
    return applySpecPlacements(canvas, ideaContext.spec)
  }
  return canvas
}

export const buildDesignFromInspiration = ({
  designIdea,
  ideaContext,
  brandColors,
  prompt = '',
  dimensionId = '1080x1080',
}) => {
  const spec = ideaContext?.spec || designIdea?.analyzedSpec
  const imageUrl = ideaContext?.imageUrl || designIdea?.imageUrl
  const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline'
  const subheadline = prompt.slice(0, 120) || ''
  const palette = spec?.colorPalette || brandColors || ['#FF6B9D', '#4DA8EE', '#1A2B48']

  const design = {
    headline,
    subheadline,
    cta: 'Learn More',
    layout: spec?.layout || 'centered',
    dimensions: { id: dimensionId },
    colorPalette: palette,
    name: 'Inspired Design',
    referenceImageUrl: imageUrl,
    designIdeaApplied: true,
    compositionNotes: ideaContext?.direction || designIdea?.analyzedDirection || '',
  }

  const context = {
    imageUrl,
    spec,
    direction: ideaContext?.direction || designIdea?.analyzedDirection,
  }

  const canvasLayout = imageUrl
    ? buildCanvasWithDesignIdea(design, context, dimensionId)
    : designToCanvas(design)

  return {
    _local: true,
    _id: nextDraftId(),
    ...design,
    canvasLayout,
    templateId: canvasLayout.templateId,
    designIdea: {
      notes: designIdea?.notes,
      imageUrl,
      referenceImageUrl: imageUrl,
    },
  }
}
