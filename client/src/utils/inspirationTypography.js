import { resolveCanvasFont } from '../constants/canvasFonts'

const clampWeight = (w, fallback) => {
  const n = Number(w)
  if (!Number.isFinite(n)) return fallback
  return Math.min(800, Math.max(300, Math.round(n / 100) * 100))
}

/** Apply extracted inspiration typography to canvas text layers */
export const applySpecTypography = (canvas, spec) => {
  if (!spec) return canvas

  const headlineFont = resolveCanvasFont(spec.fontHeadline || spec.fontFamily || spec.typography)
  const subFont = resolveCanvasFont(spec.fontSubheadline || spec.fontHeadline || spec.typography)
  const ctaFont = resolveCanvasFont(spec.fontCta || spec.fontHeadline || spec.typography)
  const letterSpacing = spec.letterSpacing ?? null

  return {
    ...canvas,
    elements: canvas.elements.map((el) => {
      if (el.id === 'headline') {
        return {
          ...el,
          fontFamily: headlineFont,
          fontWeight: clampWeight(spec.headlineWeight, el.fontWeight ?? 800),
          ...(letterSpacing != null ? { letterSpacing } : {}),
        }
      }
      if (el.id === 'subheadline') {
        return {
          ...el,
          fontFamily: subFont,
          fontWeight: clampWeight(spec.subheadlineWeight, el.fontWeight ?? 500),
        }
      }
      if (el.id === 'cta') {
        return {
          ...el,
          fontFamily: ctaFont,
          fontWeight: clampWeight(spec.ctaWeight, el.fontWeight ?? 700),
        }
      }
      if (el.type === 'text' && !el.fontFamily) {
        return { ...el, fontFamily: headlineFont }
      }
      return el
    }),
  }
}
