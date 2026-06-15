export const toDesignPreview = (item) => {
  const m = item.metadata || item
  return {
    _id: item._id,
    name: item.title || m.name || 'Design',
    headline: m.headline || item.content,
    subheadline: m.subheadline,
    cta: m.cta,
    layout: m.layout || 'centered',
    colorPalette: m.colorPalette || ['#FF6B9D', '#4DA8EE', '#1A2B48'],
    dimensions: m.dimensions,
    canvasLayout: m.canvasLayout || item.canvasLayout,
    mediaUrl: m.mediaUrl || item.mediaUrl,
    thumbnailUrl: m.thumbnailUrl || item.thumbnailUrl,
    referenceImageUrl: m.referenceImageUrl || item.referenceImageUrl,
    designIdeaBased: m.designIdeaBased || item.canvasLayout?.designIdeaBased,
    scores: m.scores?.engagement ? m.scores : (m.creativeScore || item.creativeScore),
    favorited: m.favorited,
  }
}

export const toVideoPreview = (item) => {
  const m = item.metadata || {}
  return {
    _id: item._id,
    ...m,
    title: item.title || m.title,
    hook: m.hook || item.content,
    scores: m.scores?.overall ? m.scores : (m.creativeScore || item.creativeScore),
  }
}
