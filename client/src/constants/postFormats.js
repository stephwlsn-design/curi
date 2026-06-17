import { DIMENSIONS } from './creative'

export const POST_FORMATS = [
  {
    id: 'social_post',
    label: 'Social Post',
    description: 'Square or portrait feed post',
    defaultDimension: '1080x1080',
    dimensions: ['1080x1080', '1080x1350'],
    templateId: 'centered-hero',
    creativeType: 'social_post',
  },
  {
    id: 'carousel',
    label: 'Carousel',
    description: 'Multi-slide swipeable post',
    defaultDimension: '1080x1080',
    dimensions: ['1080x1080'],
    templateId: 'carousel-slide',
    creativeType: 'carousel',
    supportsMultiSlide: true,
    defaultSlideCount: 5,
  },
  {
    id: 'story',
    label: 'Story / Reel',
    description: 'Full-screen vertical',
    defaultDimension: '1080x1920',
    dimensions: ['1080x1920'],
    templateId: 'story-vertical',
    creativeType: 'story',
  },
  {
    id: 'ad_creative',
    label: 'Ad Creative',
    description: 'Paid social & display ads',
    defaultDimension: '1200x628',
    dimensions: ['1200x628', '1080x1080', '1080x1350'],
    templateId: 'ad-bold',
    creativeType: 'ad_creative',
  },
  {
    id: 'banner',
    label: 'Banner',
    description: 'Website & display banners',
    defaultDimension: '1920x1080',
    dimensions: ['1920x1080', '1200x628'],
    templateId: 'centered-hero',
    creativeType: 'banner',
  },
  {
    id: 'thumbnail',
    label: 'Thumbnail',
    description: 'YouTube & video covers',
    defaultDimension: '1920x1080',
    dimensions: ['1920x1080'],
    templateId: 'centered-hero',
    creativeType: 'thumbnail',
  },
  {
    id: 'pin',
    label: 'Pinterest Pin',
    description: 'Tall vertical pin',
    defaultDimension: '1080x1350',
    dimensions: ['1080x1350', '1080x1920'],
    templateId: 'bottom-stack',
    creativeType: 'social_post',
  },
]

export const getPostFormat = (id) => POST_FORMATS.find((f) => f.id === id) || POST_FORMATS[0]

export const getDimensionOptions = (formatId) => {
  const format = getPostFormat(formatId)
  return DIMENSIONS.filter((d) => format.dimensions.includes(d.id))
}
