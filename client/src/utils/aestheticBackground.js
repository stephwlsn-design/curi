/** Build a text-free aesthetic background from extracted inspiration specs */

export const buildAestheticBackground = (spec, referenceImageUrl = null) => {
  const colors = spec?.colorPalette?.length
    ? spec.colorPalette
    : ['#FF6B9D', '#4DA8EE', '#1A2B48']

  return {
    type: 'aesthetic',
    colors,
    angle: spec?.gradientAngle ?? 135,
    textureUrl: referenceImageUrl || null,
    textureOpacity: spec?.textureOpacity ?? 0.2,
    textureBlur: spec?.textureBlur ?? 28,
    overlay: `rgba(0,0,0,${spec?.overlayOpacity ?? 0.12})`,
  }
}
