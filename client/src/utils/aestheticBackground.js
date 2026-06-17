/** Build a text-free aesthetic background from extracted inspiration specs */

export const buildAestheticBackground = (spec, referenceImageUrl = null) => {
  const colors = spec?.colorPalette?.length
    ? spec.colorPalette
    : [spec?.backgroundColor || '#FF6B9D', spec?.secondaryBackgroundColor || '#4DA8EE', '#1A2B48']

  const mode = spec?.backgroundMode || (referenceImageUrl ? 'reference-photo' : 'solid')
  const overlayOpacity = spec?.overlayOpacity ?? (mode === 'reference-photo' ? 0.1 : 0.15)
  const underlay = spec?.backgroundColor || colors[0]

  if (mode === 'solid') {
    return {
      type: 'solid',
      color: underlay,
      colors: [underlay, spec?.secondaryBackgroundColor || colors[1] || underlay],
    }
  }

  if (mode === 'reference-photo' && referenceImageUrl) {
    return {
      type: 'image',
      url: referenceImageUrl,
      underlayColor: underlay,
      overlay: spec?.overlayColor || `rgba(0,0,0,${overlayOpacity})`,
      objectFit: 'cover',
    }
  }

  if (mode === 'reference-blur' && referenceImageUrl) {
    return {
      type: 'aesthetic',
      colors: [underlay, ...colors.slice(1)],
      angle: spec?.gradientAngle ?? 135,
      textureUrl: referenceImageUrl,
      textureOpacity: spec?.textureOpacity ?? 0.55,
      textureBlur: spec?.textureBlur ?? 12,
      overlay: `rgba(0,0,0,${overlayOpacity})`,
      underlayColor: underlay,
    }
  }

  return {
    type: 'aesthetic',
    colors: [underlay, ...colors.slice(1)],
    angle: spec?.gradientAngle ?? 135,
    textureUrl: referenceImageUrl || null,
    textureOpacity: spec?.textureOpacity ?? (referenceImageUrl ? 0.4 : 0.25),
    textureBlur: spec?.textureBlur ?? 20,
    overlay: `rgba(0,0,0,${overlayOpacity})`,
    underlayColor: underlay,
  }
}
