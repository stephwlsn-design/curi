import { designToCanvas } from './designCanvas'

export const applyPexelsPhotoToCanvas = (canvas, photoUrl, mode = 'background') => {
  if (mode === 'layer') {
    const id = `pexels-${Date.now()}`
    return {
      ...canvas,
      elements: [
        ...canvas.elements,
        {
          id,
          type: 'image',
          url: photoUrl,
          x: Math.round(canvas.width * 0.08),
          y: Math.round(canvas.height * 0.12),
          width: Math.round(canvas.width * 0.84),
          height: Math.round(canvas.height * 0.45),
          borderRadius: 12,
          visible: true,
          zIndex: 3,
        },
      ],
    }
  }

  return {
    ...canvas,
    background: {
      type: 'image',
      url: photoUrl,
      overlay: 'rgba(0,0,0,0.38)',
    },
  }
}

export const buildCanvasFromPexelsPhoto = ({
  photoUrl,
  dimensionId = '1080x1080',
  headline = 'Your Headline',
  subheadline = '',
  cta = 'Learn More',
  useAs = 'background',
}) => {
  const base = designToCanvas({
    headline,
    subheadline,
    cta,
    dimensions: { id: dimensionId },
  })
  return applyPexelsPhotoToCanvas(base, photoUrl, useAs)
}

export const buildCanvasFromPexelsVideo = ({
  posterUrl,
  videoUrl,
  dimensionId = '1080x1080',
  headline = 'Video Design',
}) => ({
  width: dimensionId === '1080x1920' ? 1080 : dimensionId === '1920x1080' ? 1920 : 1080,
  height: dimensionId === '1080x1920' ? 1920 : dimensionId === '1920x1080' ? 1080 : 1080,
  templateId: 'pexels-video',
  background: {
    type: 'video',
    url: videoUrl,
    poster: posterUrl,
    overlay: 'rgba(0,0,0,0.25)',
  },
  elements: headline ? [{
    id: 'headline',
    type: 'text',
    text: headline,
    x: 48,
    y: 48,
    width: 984,
    fontSize: 42,
    fontWeight: 800,
    color: '#ffffff',
    align: 'left',
    visible: true,
    zIndex: 4,
  }] : [],
})
