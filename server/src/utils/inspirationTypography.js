const CANVAS_FONTS = [
  { id: 'quicksand', label: 'Quicksand', family: '"Quicksand", system-ui, sans-serif' },
  { id: 'poppins', label: 'Poppins', family: '"Poppins", system-ui, sans-serif' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat", system-ui, sans-serif' },
  { id: 'inter', label: 'Inter', family: '"Inter", system-ui, sans-serif' },
  { id: 'raleway', label: 'Raleway', family: '"Raleway", system-ui, sans-serif' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: '"Space Grotesk", system-ui, sans-serif' },
  { id: 'oswald', label: 'Oswald', family: '"Oswald", system-ui, sans-serif' },
  { id: 'bebas-neue', label: 'Bebas Neue', family: '"Bebas Neue", Impact, sans-serif' },
  { id: 'playfair', label: 'Playfair Display', family: '"Playfair Display", Georgia, serif' },
  { id: 'lora', label: 'Lora', family: '"Lora", Georgia, serif' },
  { id: 'merriweather', label: 'Merriweather', family: '"Merriweather", Georgia, serif' },
  { id: 'caveat', label: 'Caveat', family: '"Caveat", cursive' },
];

const FONT_BY_ID = Object.fromEntries(CANVAS_FONTS.map((f) => [f.id, f]));

const resolveCanvasFont = (input) => {
  if (!input) return CANVAS_FONTS[0].family;
  const raw = String(input).trim();
  const byId = FONT_BY_ID[raw.toLowerCase().replace(/\s+/g, '-')];
  if (byId) return byId.family;
  const byLabel = CANVAS_FONTS.find((f) => f.label.toLowerCase() === raw.toLowerCase());
  if (byLabel) return byLabel.family;
  if (raw.includes('"') || raw.includes(',')) return raw;

  const lower = raw.toLowerCase();
  if (lower.includes('bebas') || lower.includes('condensed')) return FONT_BY_ID['bebas-neue'].family;
  if (lower.includes('serif') && !lower.includes('sans')) return FONT_BY_ID.playfair.family;
  if (lower.includes('script') || lower.includes('hand')) return FONT_BY_ID.caveat.family;
  if (lower.includes('montserrat') || lower.includes('geometric')) return FONT_BY_ID.montserrat.family;
  return FONT_BY_ID.poppins.family;
};

const clampWeight = (w, fallback) => {
  const n = Number(w);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(800, Math.max(300, Math.round(n / 100) * 100));
};

const normalizeHex = (value) => {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/#[0-9A-Fa-f]{6}/);
  return m ? m[0] : null;
};

const normalizeSpec = (parsed) => {
  const palette = Array.isArray(parsed.colorPalette)
    ? parsed.colorPalette.map(normalizeHex).filter(Boolean).slice(0, 6)
    : [];

  return {
    colorPalette: palette.length ? palette : ['#FF6B9D', '#4DA8EE', '#1A2B48'],
    layout: parsed.layout || 'centered',
    textColor: normalizeHex(parsed.textColor) || '#ffffff',
    subtextColor: parsed.subtextColor || 'rgba(255,255,255,0.85)',
    ctaBackground: normalizeHex(parsed.ctaBackground) || '#ffffff',
    ctaTextColor: normalizeHex(parsed.ctaTextColor) || '#1A2B48',
    overlayOpacity: parsed.overlayOpacity ?? 0.35,
    textureOpacity: parsed.textureOpacity ?? 0.4,
    textureBlur: parsed.textureBlur ?? 16,
    gradientAngle: parsed.gradientAngle ?? 135,
    typography: parsed.typography || 'bold sans-serif',
    fontHeadline: parsed.fontHeadline || null,
    fontSubheadline: parsed.fontSubheadline || null,
    fontCta: parsed.fontCta || null,
    headlineWeight: parsed.headlineWeight ?? 800,
    subheadlineWeight: parsed.subheadlineWeight ?? 500,
    ctaWeight: parsed.ctaWeight ?? 700,
    letterSpacing: parsed.letterSpacing ?? null,
    backgroundMode: parsed.backgroundMode || 'reference-photo',
    placements: parsed.placements || null,
    aestheticOnly: true,
    mood: parsed.mood || null,
  };
};

const applySpecTypography = (canvas, spec) => {
  if (!spec) return canvas;

  const headlineFont = resolveCanvasFont(spec.fontHeadline || spec.fontFamily || spec.typography);
  const subFont = resolveCanvasFont(spec.fontSubheadline || spec.fontHeadline || spec.typography);
  const ctaFont = resolveCanvasFont(spec.fontCta || spec.fontHeadline || spec.typography);

  return {
    ...canvas,
    elements: canvas.elements.map((el) => {
      if (el.id === 'headline') {
        return {
          ...el,
          fontFamily: headlineFont,
          fontWeight: clampWeight(spec.headlineWeight, el.fontWeight ?? 800),
        };
      }
      if (el.id === 'subheadline') {
        return {
          ...el,
          fontFamily: subFont,
          fontWeight: clampWeight(spec.subheadlineWeight, el.fontWeight ?? 500),
        };
      }
      if (el.id === 'cta') {
        return {
          ...el,
          fontFamily: ctaFont,
          fontWeight: clampWeight(spec.ctaWeight, el.fontWeight ?? 700),
        };
      }
      if (el.type === 'text' && !el.fontFamily) {
        return { ...el, fontFamily: headlineFont };
      }
      return el;
    }),
  };
};

module.exports = {
  resolveCanvasFont,
  normalizeSpec,
  applySpecTypography,
};
