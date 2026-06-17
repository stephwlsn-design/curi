/** Build a text-free aesthetic background from extracted inspiration specs */

export const buildAestheticBackground = (spec, referenceImageUrl = null) => {
  const colors = spec?.colorPalette?.length
    ? spec.colorPalette
    : ['#FF6B9D', '#4DA8EE', '#1A2B48']

  const mode = spec?.backgroundMode || (referenceImageUrl ? 'reference-photo' : 'gradient')
  const overlayOpacity = spec?.overlayOpacity ?? (mode === 'reference-photo' ? 0.38 : 0.15)

  // Full reference photo — closest match to the original design look
  if (mode === 'reference-photo' && referenceImageUrl) {
    return {
      type: 'image',
      url: referenceImageUrl,
      overlay: spec?.overlayColor || `rgba(0,0,0,${overlayOpacity})`,
    }
  }

  // Blurred reference texture over gradient — mood/colour match with softer photo feel
  if (mode === 'reference-blur' && referenceImageUrl) {
    return {
      type: 'aesthetic',
      colors,
      angle: spec?.gradientAngle ?? 135,
      textureUrl: referenceImageUrl,
      textureOpacity: spec?.textureOpacity ?? 0.5,
      textureBlur: spec?.textureBlur ?? 14,
      overlay: `rgba(0,0,0,${overlayOpacity})`,
    }
  }

  return {
    type: 'aesthetic',
    colors,
    angle: spec?.gradientAngle ?? 135,
    textureUrl: referenceImageUrl || null,
    textureOpacity: spec?.textureOpacity ?? (referenceImageUrl ? 0.35 : 0.2),
    textureBlur: spec?.textureBlur ?? 24,
    overlay: `rgba(0,0,0,${overlayOpacity})`,
  }
}
