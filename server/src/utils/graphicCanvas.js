const templates = require('../../../shared/graphicDesignTemplates.json');

const DIM_MAP = {
  '1080x1080': { width: 1080, height: 1080 },
  '1080x1350': { width: 1080, height: 1350 },
  '1080x1920': { width: 1080, height: 1920 },
  '1920x1080': { width: 1920, height: 1080 },
  '1200x628': { width: 1200, height: 628 },
};

const GRAPHIC_DESIGN_TEMPLATES = templates;

const getGraphicTemplate = (id) => GRAPHIC_DESIGN_TEMPLATES.find((t) => t.id === id);

const resolveBackground = (bg, brandColors) => {
  if (!bg) return { type: 'gradient', colors: brandColors || ['#FF6B9D', '#4DA8EE'], angle: 135 };
  if (bg.type === 'gradient') {
    return {
      type: 'gradient',
      colors: bg.colors || brandColors || ['#FF6B9D', '#4DA8EE'],
      angle: bg.angle || 135,
    };
  }
  if (bg.type === 'color') return { type: 'color', color: bg.color };
  if (bg.type === 'image') return { type: 'image', url: bg.url, overlay: bg.overlay };
  return bg;
};

const scaleElement = (el, width, height, copy) => {
  const out = { ...el, visible: el.visible !== false, zIndex: el.zIndex ?? 2 };
  if (el.x != null) out.x = Math.round(el.x * width);
  if (el.y != null) out.y = Math.round(el.y * height);
  if (el.w != null) out.width = Math.round(el.w * width);
  if (el.h != null) out.height = Math.round(el.h * height);

  if (el.bind && copy) {
    const val = copy[el.bind] ?? '';
    if (el.type === 'badge' || el.type === 'text' || el.type === 'button') {
      out.text = val;
      if (el.type === 'badge' || el.type === 'button' || el.type === 'text') {
        out.visible = Boolean(val);
      }
    }
  }
  return out;
};

const buildGraphicCanvas = (template, copy = {}, dimensionId) => {
  const dimId = dimensionId || template.recommendedDimension || '1080x1080';
  const dims = DIM_MAP[dimId] || DIM_MAP['1080x1080'];
  const merged = {
    headline: copy.headline ?? template.sampleCopy?.headline ?? '',
    subheadline: copy.subheadline ?? template.sampleCopy?.subheadline ?? '',
    cta: copy.cta ?? template.sampleCopy?.cta ?? '',
    badge: copy.badge ?? template.sampleCopy?.badge ?? '',
  };

  const elements = (template.elements || [])
    .map((el) => scaleElement(el, dims.width, dims.height, merged))
    .sort((a, b) => (a.zIndex ?? 2) - (b.zIndex ?? 2));

  return {
    width: dims.width,
    height: dims.height,
    templateId: template.id,
    graphicTemplate: true,
    background: resolveBackground(template.background, copy.colorPalette),
    elements,
  };
};

module.exports = {
  GRAPHIC_DESIGN_TEMPLATES,
  getGraphicTemplate,
  buildGraphicCanvas,
};
