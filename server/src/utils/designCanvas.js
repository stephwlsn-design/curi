const BUILTIN_TEMPLATES = [
  {
    id: 'centered-hero',
    name: 'Centered Hero',
    description: 'Bold headline centered with CTA below',
    placements: {
      badge: { x: 0.04, y: 0.04, width: 0.22 },
      headline: { x: 0.08, y: 0.32, width: 0.84, align: 'center', fontSize: 52 },
      subheadline: { x: 0.1, y: 0.48, width: 0.8, align: 'center', fontSize: 22 },
      cta: { x: 0.32, y: 0.72, width: 0.36 },
    },
  },
  {
    id: 'split-left',
    name: 'Split Left',
    description: 'Copy aligned left',
    placements: {
      badge: { x: 0.05, y: 0.05, width: 0.2 },
      headline: { x: 0.05, y: 0.28, width: 0.55, align: 'left', fontSize: 44 },
      subheadline: { x: 0.05, y: 0.5, width: 0.5, align: 'left', fontSize: 20 },
      cta: { x: 0.05, y: 0.78, width: 0.3 },
    },
  },
  {
    id: 'bottom-stack',
    name: 'Bottom Stack',
    description: 'Content anchored to bottom',
    placements: {
      badge: { x: 0.05, y: 0.05, width: 0.2 },
      headline: { x: 0.05, y: 0.58, width: 0.9, align: 'left', fontSize: 40 },
      subheadline: { x: 0.05, y: 0.72, width: 0.85, align: 'left', fontSize: 18 },
      cta: { x: 0.05, y: 0.86, width: 0.28 },
    },
  },
  {
    id: 'minimal-top',
    name: 'Minimal Top',
    description: 'Clean headline at top',
    placements: {
      badge: { x: 0.05, y: 0.06, width: 0.18 },
      headline: { x: 0.05, y: 0.14, width: 0.9, align: 'left', fontSize: 48 },
      subheadline: { x: 0.05, y: 0.28, width: 0.7, align: 'left', fontSize: 20 },
      cta: { x: 0.05, y: 0.88, width: 0.25 },
    },
  },
  {
    id: 'story-vertical',
    name: 'Story Vertical',
    description: '9:16 story format',
    placements: {
      badge: { x: 0.05, y: 0.08, width: 0.25 },
      headline: { x: 0.06, y: 0.38, width: 0.88, align: 'center', fontSize: 46 },
      subheadline: { x: 0.08, y: 0.52, width: 0.84, align: 'center', fontSize: 20 },
      cta: { x: 0.2, y: 0.78, width: 0.6 },
    },
  },
  {
    id: 'ad-bold',
    name: 'Ad Bold',
    placements: {
      badge: { x: 0.04, y: 0.04, width: 0.24 },
      headline: { x: 0.05, y: 0.2, width: 0.9, align: 'left', fontSize: 56 },
      subheadline: { x: 0.05, y: 0.42, width: 0.75, align: 'left', fontSize: 22 },
      cta: { x: 0.55, y: 0.75, width: 0.38 },
    },
  },
  {
    id: 'quote-card',
    placements: {
      badge: { x: 0.05, y: 0.05, width: 0.2 },
      headline: { x: 0.08, y: 0.3, width: 0.84, align: 'center', fontSize: 38 },
      subheadline: { x: 0.1, y: 0.62, width: 0.8, align: 'center', fontSize: 20 },
      cta: { x: 0.35, y: 0.82, width: 0.3 },
    },
  },
  {
    id: 'flash-sale',
    placements: {
      badge: { x: 0.05, y: 0.05, width: 0.28 },
      headline: { x: 0.06, y: 0.22, width: 0.88, align: 'left', fontSize: 72 },
      subheadline: { x: 0.06, y: 0.52, width: 0.8, align: 'left', fontSize: 22 },
      cta: { x: 0.06, y: 0.78, width: 0.42 },
    },
  },
  {
    id: 'event-promo',
    placements: {
      badge: { x: 0.04, y: 0.08, width: 0.22 },
      headline: { x: 0.05, y: 0.24, width: 0.55, align: 'left', fontSize: 48 },
      subheadline: { x: 0.05, y: 0.58, width: 0.5, align: 'left', fontSize: 20 },
      cta: { x: 0.05, y: 0.72, width: 0.32 },
    },
  },
  {
    id: 'linkedin-post',
    placements: {
      badge: { x: 0.04, y: 0.1, width: 0.2 },
      headline: { x: 0.05, y: 0.22, width: 0.9, align: 'left', fontSize: 42 },
      subheadline: { x: 0.05, y: 0.55, width: 0.75, align: 'left', fontSize: 20 },
      cta: { x: 0.05, y: 0.74, width: 0.26 },
    },
  },
  {
    id: 'carousel-slide',
    placements: {
      badge: { x: 0.05, y: 0.05, width: 0.22 },
      headline: { x: 0.05, y: 0.18, width: 0.7, align: 'left', fontSize: 56 },
      subheadline: { x: 0.05, y: 0.42, width: 0.85, align: 'left', fontSize: 24 },
      cta: { x: 0.05, y: 0.82, width: 0.28 },
    },
  },
  {
    id: 'youtube-thumb',
    placements: {
      badge: { x: 0.03, y: 0.06, width: 0.18 },
      headline: { x: 0.04, y: 0.76, width: 0.92, align: 'left', fontSize: 64 },
      subheadline: { x: 0.04, y: 0.58, width: 0.6, align: 'left', fontSize: 28 },
      cta: { x: 0.04, y: 0.88, width: 0.2 },
    },
  },
  {
    id: 'newsletter-header',
    placements: {
      badge: { x: 0.05, y: 0.12, width: 0.24 },
      headline: { x: 0.05, y: 0.28, width: 0.9, align: 'left', fontSize: 46 },
      subheadline: { x: 0.05, y: 0.52, width: 0.7, align: 'left', fontSize: 20 },
      cta: { x: 0.05, y: 0.7, width: 0.28 },
    },
  },
  {
    id: 'product-spotlight',
    placements: {
      badge: { x: 0.05, y: 0.05, width: 0.22 },
      headline: { x: 0.05, y: 0.6, width: 0.9, align: 'left', fontSize: 44 },
      subheadline: { x: 0.05, y: 0.72, width: 0.85, align: 'left', fontSize: 20 },
      cta: { x: 0.05, y: 0.86, width: 0.4 },
    },
  },
]

const LAYOUT_TO_TEMPLATE = {
  centered: 'centered-hero',
  split: 'split-left',
  grid: 'bottom-stack',
  hero: 'centered-hero',
  minimal: 'minimal-top',
  story: 'story-vertical',
  ad: 'ad-bold',
  quote: 'quote-card',
  sale: 'flash-sale',
  event: 'event-promo',
  linkedin: 'linkedin-post',
  carousel: 'carousel-slide',
  thumbnail: 'youtube-thumb',
  newsletter: 'newsletter-header',
  product: 'product-spotlight',
}

const DIM_MAP = {
  '1080x1080': { width: 1080, height: 1080 },
  '1080x1350': { width: 1080, height: 1350 },
  '1080x1920': { width: 1080, height: 1920 },
  '1920x1080': { width: 1920, height: 1080 },
  '1200x628': { width: 1200, height: 628 },
}

const parseDimensions = (design) => {
  const id = design?.dimensions?.id || design?.dimensionId || '1080x1080'
  return DIM_MAP[id] || DIM_MAP['1080x1080']
}

const designToCanvas = (design, templateId) => {
  const dims = parseDimensions(design)
  const colors = design?.colorPalette || ['#FF6B9D', '#4DA8EE', '#1A2B48']
  const tid = templateId || LAYOUT_TO_TEMPLATE[design?.layout] || 'centered-hero'
  const template = BUILTIN_TEMPLATES.find(t => t.id === tid) || BUILTIN_TEMPLATES[0]
  const p = template.placements

  const px = (key, field, fallback) => {
    const v = p[key]?.[field]
    if (v == null) return fallback
    if (field === 'x' || field === 'y' || field === 'width') {
      return Math.round(v * (field === 'width' || field === 'x' ? dims.width : dims.height))
    }
    return v
  }

  return {
    width: dims.width,
    height: dims.height,
    templateId: tid,
    background: { type: 'gradient', colors: [colors[0], colors[1] || colors[0]], angle: 135 },
    elements: [
      { id: 'badge', type: 'badge', text: design?.layout || 'centered', x: px('badge', 'x', 40), y: px('badge', 'y', 40), width: px('badge', 'width', 180), fontSize: 14, color: '#ffffff', visible: true },
      { id: 'headline', type: 'text', text: design?.headline || '', x: px('headline', 'x', 48), y: px('headline', 'y', Math.round(dims.height * 0.35)), width: px('headline', 'width', dims.width - 96), fontSize: p.headline?.fontSize || 48, fontWeight: 800, color: '#ffffff', align: p.headline?.align || 'left', visible: true },
      { id: 'subheadline', type: 'text', text: design?.subheadline || '', x: px('subheadline', 'x', 48), y: px('subheadline', 'y', Math.round(dims.height * 0.5)), width: px('subheadline', 'width', dims.width - 96), fontSize: p.subheadline?.fontSize || 20, fontWeight: 500, color: 'rgba(255,255,255,0.85)', align: p.subheadline?.align || 'left', visible: Boolean(design?.subheadline) },
      { id: 'cta', type: 'button', text: design?.cta || 'Learn More', x: px('cta', 'x', 48), y: px('cta', 'y', Math.round(dims.height * 0.78)), width: px('cta', 'width', 220), fontSize: 14, fontWeight: 700, color: '#1A2B48', bgColor: '#ffffff', visible: Boolean(design?.cta) },
    ],
  }
}

function applySpecPlacements(canvas, spec) {
  if (!spec?.placements) return canvas;
  const { width, height } = canvas;
  const elements = canvas.elements.map((el) => {
    const p = spec.placements[el.id];
    if (!p) return el;
    const patch = {};
    if (p.x != null) patch.x = Math.round(p.x * width);
    if (p.y != null) patch.y = Math.round(p.y * height);
    if (p.width != null) patch.width = Math.round(p.width * width);
    if (p.fontSize != null) patch.fontSize = p.fontSize;
    if (p.align) patch.align = p.align;
    if (el.id === 'headline' || el.id === 'subheadline') {
      patch.color = spec.textColor || el.color;
      if (el.id === 'subheadline') patch.color = spec.subtextColor || patch.color;
    }
    if (el.id === 'cta') {
      patch.bgColor = spec.ctaBackground || el.bgColor;
      patch.color = spec.ctaTextColor || el.color;
    }
    return { ...el, ...patch };
  });
  return { ...canvas, elements };
}

function buildCanvasWithDesignIdea(design, ideaContext, dimensionId) {
  const templateId = ideaContext?.spec?.layout
    ? ({ centered: 'centered-hero', split: 'split-left', grid: 'bottom-stack', hero: 'centered-hero', minimal: 'minimal-top' }[ideaContext.spec.layout] || 'centered-hero')
    : undefined;
  const canvas = designToCanvas(design, templateId);
  if (!ideaContext?.imageUrl) return canvas;

  const opacity = ideaContext.spec?.overlayOpacity ?? 0.35;
  canvas.background = {
    type: 'image',
    url: ideaContext.imageUrl,
    overlay: `rgba(0,0,0,${opacity})`,
  };
  canvas.referenceImageUrl = ideaContext.imageUrl;
  canvas.designIdeaBased = true;

  if (ideaContext.spec) {
    return applySpecPlacements(canvas, ideaContext.spec);
  }
  return canvas;
}

module.exports = { designToCanvas, BUILTIN_TEMPLATES, buildCanvasWithDesignIdea };
