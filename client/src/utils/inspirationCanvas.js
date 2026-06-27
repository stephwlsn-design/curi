import {
  enrichDesignIdeaWithPreview,
  extractLocalAestheticSpec,
  mergeInspirationSpecs,
  isWeakInspirationSpec,
} from './inspirationImage'
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

/** Minimal replica spec when AI analysis is still pending — palette + decor only, no reference image. */
export const buildMinimalAestheticSpec = (brandColors = []) => {
  const palette = brandColors?.length
    ? brandColors
    : ['#FF6B9D', '#4DA8EE', '#1A2B48']
  const accent = palette[1] || palette[0]
  return {
    colorPalette: palette,
    backgroundColor: palette[0],
    secondaryBackgroundColor: accent,
    layout: 'centered',
    backgroundMode: 'aesthetic',
    textColor: '#ffffff',
    subtextColor: 'rgba(255,255,255,0.85)',
    ctaBackground: '#ffffff',
    ctaTextColor: palette[0],
    gradientAngle: 135,
    decorElements: [
      { shape: 'rect', x: 0, y: 0, width: 1, height: 0.06, fill: accent, borderRadius: 0 },
      { shape: 'circle', x: 0.82, y: 0.06, width: 0.14, height: 0.14, fill: `${palette[2] || accent}44` },
      { shape: 'rect', x: 0.06, y: 0.88, width: 0.22, height: 0.04, fill: 'rgba(255,255,255,0.2)', borderRadius: 8 },
    ],
    iconElements: [],
    aestheticOnly: true,
  }
}

export const buildCanvasWithDesignIdea = (design, ideaContext, dimensionId = '1080x1080', templateId) => {
  const spec = ideaContext?.spec
  if (!spec?.colorPalette?.length && !spec?.backgroundColor) {
    return designToCanvas({ ...design, dimensions: { id: dimensionId } }, templateId)
  }

  const resolvedTemplate = templateId
    || (spec?.layout
      ? (LAYOUT_TEMPLATE_MAP[spec.layout] || 'centered-hero')
      : (LAYOUT_TO_TEMPLATE[design?.layout] || 'centered-hero'))

  const canvas = designToCanvas({ ...design, dimensions: { id: dimensionId } }, resolvedTemplate)
  canvas.background = buildAestheticBackground(spec)
  canvas.designIdeaBased = true
  canvas.aestheticOnly = true

  const styled = applyInspirationSpec(canvas, spec)
  return applySpecTypography(styled, spec)
}

export const hasUsableInspirationSpec = (designIdea) => (
  designIdea?.analyzedSpec?.inspirationAnalyzed === true
  && !isWeakInspirationSpec(designIdea.analyzedSpec)
)

export const mergeDesignIdeaSources = (primary, fallback) => {
  const a = primary || {}
  const b = fallback || {}
  if (
    !a.notes && !a.filename && !a.imageUrl && !a.previewDataUrl && !a.analyzedDirection && !a.analyzedSpec
    && !b.notes && !b.filename && !b.imageUrl && !b.previewDataUrl && !b.analyzedDirection && !b.analyzedSpec
  ) {
    return null
  }
  const analyzedSpec = a.analyzedSpec?.inspirationAnalyzed
    ? a.analyzedSpec
    : (b.analyzedSpec?.inspirationAnalyzed ? b.analyzedSpec : (a.analyzedSpec || b.analyzedSpec))
  return {
    notes: a.notes || b.notes || '',
    filename: a.filename || b.filename,
    imageUrl: a.imageUrl || b.imageUrl,
    previewDataUrl: a.previewDataUrl || b.previewDataUrl,
    analyzedDirection: a.analyzedDirection || b.analyzedDirection,
    analyzedSpec,
    uploadedAt: a.uploadedAt || b.uploadedAt,
  }
}

export const mergeDesignIdeaRefs = (idea, imageRef) => {
  const ref = imageRef || idea?.previewDataUrl || idea?.imageUrl
  const isDataUrl = typeof ref === 'string' && ref.startsWith('data:')
  const isBlobUrl = typeof ref === 'string' && ref.startsWith('blob:')
  return {
    ...(idea || {}),
    notes: idea?.notes || '',
    imageUrl: idea?.imageUrl || (!isDataUrl && !isBlobUrl ? ref : undefined),
    previewDataUrl: idea?.previewDataUrl || (isDataUrl ? ref : undefined),
    filename: idea?.filename,
  }
}

/** Ensure inspiration has AI-extracted aesthetics before building canvas locally. */
export const resolveInspirationForCanvas = async ({
  api,
  workspaceId,
  designIdea,
  imageRef,
  brief = '',
  dimensionId = '1080x1080',
  postFormat = 'social_post',
  creativeType = 'social_post',
  templateId,
}) => {
  const merged = await enrichDesignIdeaWithPreview(mergeDesignIdeaRefs(designIdea, imageRef))
  const localSpec = merged?.previewDataUrl
    ? await extractLocalAestheticSpec(merged.previewDataUrl)
    : null

  if (hasUsableInspirationSpec(merged) && merged.analyzedDirection) {
    const spec = isWeakInspirationSpec(merged.analyzedSpec) && localSpec
      ? mergeInspirationSpecs(localSpec, merged.analyzedSpec)
      : merged.analyzedSpec
    return {
      designIdea: { ...merged, analyzedSpec: spec },
      ideaContext: {
        spec,
        direction: merged.analyzedDirection,
      },
    }
  }

  let ideaContext = localSpec
    ? { direction: 'Match the uploaded reference aesthetic', spec: localSpec }
    : null

  try {
    const { previewDataUrl, ...ideaForApi } = merged
    const { data } = await api.post('/design/from-inspiration', {
      workspaceId,
      designIdea: ideaForApi,
      prompt: brief,
      dimensionId,
      postFormat,
      creativeType,
      templateId,
      analyzeOnly: true,
    }, { timeout: 55000 })

    const enriched = data.designIdea
      ? await enrichDesignIdeaWithPreview({
        ...data.designIdea,
        previewDataUrl: data.designIdea.previewDataUrl || merged.previewDataUrl,
      })
      : merged
    const aiSpec = data.ideaContext?.spec || enriched.analyzedSpec
    const mergedSpec = mergeInspirationSpecs(localSpec, aiSpec)

    ideaContext = {
      direction: data.ideaContext?.direction || enriched.analyzedDirection || ideaContext?.direction,
      spec: mergedSpec,
    }

    return {
      designIdea: { ...enriched, analyzedSpec: mergedSpec, analyzedDirection: ideaContext.direction },
      ideaContext,
    }
  } catch (err) {
    if (ideaContext?.spec) {
      return {
        designIdea: { ...merged, analyzedSpec: ideaContext.spec },
        ideaContext,
      }
    }
    throw err
  }
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
  const palette = brandColors?.length
    ? brandColors
    : ['#FF6B9D', '#4DA8EE', '#1A2B48']
  const rawSpec = ideaContext?.spec || designIdea?.analyzedSpec
  const spec = (rawSpec && !isWeakInspirationSpec(rawSpec))
    ? rawSpec
    : buildMinimalAestheticSpec(palette)
  const promptLines = prompt.split('\n').map((line) => line.trim()).filter(Boolean)
  const baseHeadline = promptLines[0]?.slice(0, 80)
    || designIdea?.notes?.split('\n').map((l) => l.trim()).filter(Boolean)[0]?.slice(0, 80)
    || 'Your Headline'
  const subheadline = promptLines[1]?.slice(0, 120)
    || prompt.slice(baseHeadline.length).trim().slice(0, 120)
    || designIdea?.notes?.slice(0, 120)
    || ''
  const templateId = format.templateId
  const carouselCtas = ['Swipe →', 'Next →', 'Keep reading →', 'Learn more →', 'See more →']

  let headline = baseHeadline
  let cta = 'Learn More'
  if (postFormat === 'carousel' && slideTotal > 1) {
    headline = promptLines[slideIndex - 1]?.slice(0, 80)
      || `${baseHeadline.replace(/\s*—\s*\d+$/, '')} — ${slideIndex}`
    cta = slideIndex < slideTotal
      ? carouselCtas[(slideIndex - 1) % carouselCtas.length]
      : 'Learn More'
  }

  const design = {
    headline,
    subheadline,
    cta,
    layout: postFormat === 'carousel' ? 'carousel' : (spec?.layout || format.id),
    dimensions: { id: dimensionId },
    colorPalette: spec?.colorPalette || palette,
    name: `${format.label}${slideTotal > 1 ? ` — Slide ${slideIndex}` : ''}`,
    designIdeaApplied: true,
    postFormat: format.id,
    creativeType: format.creativeType,
    compositionNotes: ideaContext?.direction || designIdea?.analyzedDirection || '',
  }

  const context = {
    spec,
    direction: ideaContext?.direction || designIdea?.analyzedDirection,
  }

  const canvasLayout = buildCanvasWithDesignIdea(design, context, dimensionId, templateId)

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
      analyzedDirection: designIdea?.analyzedDirection,
      analyzedSpec: spec,
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
