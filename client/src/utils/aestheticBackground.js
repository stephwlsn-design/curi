/** Build a text-free aesthetic background from extracted specs — never embeds the reference upload. */

export const buildAestheticBackground = (spec) => {
  const colors = spec?.colorPalette?.length
    ? spec.colorPalette
    : [spec?.backgroundColor || '#FF6B9D', spec?.secondaryBackgroundColor || '#4DA8EE', '#1A2B48']

  const underlay = spec?.backgroundColor || colors[0]
  const mode = spec?.backgroundMode === 'solid' ? 'solid' : 'aesthetic'

  if (mode === 'solid') {
    return {
      type: 'solid',
      color: underlay,
      colors: [underlay, spec?.secondaryBackgroundColor || colors[1] || underlay],
    }
  }

  return {
    type: 'aesthetic',
    colors: [underlay, ...colors.slice(1).filter(Boolean)],
    angle: spec?.gradientAngle ?? 135,
    overlay: spec?.overlayOpacity != null
      ? `rgba(0,0,0,${spec.overlayOpacity})`
      : undefined,
    underlayColor: underlay,
  }
}
