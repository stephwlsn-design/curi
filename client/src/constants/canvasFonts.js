/** Google Fonts loaded in index.html — used on design canvas text layers */
export const CANVAS_FONTS = [
  { id: 'quicksand', label: 'Quicksand', family: '"Quicksand", system-ui, sans-serif', category: 'Rounded' },
  { id: 'poppins', label: 'Poppins', family: '"Poppins", system-ui, sans-serif', category: 'Modern' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat", system-ui, sans-serif', category: 'Modern' },
  { id: 'inter', label: 'Inter', family: '"Inter", system-ui, sans-serif', category: 'Clean' },
  { id: 'raleway', label: 'Raleway', family: '"Raleway", system-ui, sans-serif', category: 'Elegant' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: '"Space Grotesk", system-ui, sans-serif', category: 'Tech' },
  { id: 'oswald', label: 'Oswald', family: '"Oswald", system-ui, sans-serif', category: 'Bold' },
  { id: 'bebas-neue', label: 'Bebas Neue', family: '"Bebas Neue", Impact, sans-serif', category: 'Display' },
  { id: 'playfair', label: 'Playfair Display', family: '"Playfair Display", Georgia, serif', category: 'Serif' },
  { id: 'lora', label: 'Lora', family: '"Lora", Georgia, serif', category: 'Serif' },
  { id: 'merriweather', label: 'Merriweather', family: '"Merriweather", Georgia, serif', category: 'Serif' },
  { id: 'caveat', label: 'Caveat', family: '"Caveat", cursive', category: 'Script' },
]

export const FONT_WEIGHTS = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra Bold' },
]

const FONT_BY_ID = Object.fromEntries(CANVAS_FONTS.map((f) => [f.id, f]))

/** Map AI typography hints or font id to a CSS font-family stack */
export const resolveCanvasFont = (input) => {
  if (!input) return CANVAS_FONTS[0].family
  const raw = String(input).trim()
  const byId = FONT_BY_ID[raw.toLowerCase().replace(/\s+/g, '-')]
  if (byId) return byId.family
  const byLabel = CANVAS_FONTS.find((f) => f.label.toLowerCase() === raw.toLowerCase())
  if (byLabel) return byLabel.family
  if (raw.includes('"') || raw.includes(',')) return raw

  const lower = raw.toLowerCase()
  if (lower.includes('bebas') || lower.includes('impact') || lower.includes('condensed')) {
    return FONT_BY_ID['bebas-neue'].family
  }
  if (lower.includes('playfair') || (lower.includes('serif') && !lower.includes('sans'))) {
    return FONT_BY_ID.playfair.family
  }
  if (lower.includes('lora') || lower.includes('merriweather')) {
    return FONT_BY_ID.lora.family
  }
  if (lower.includes('script') || lower.includes('hand') || lower.includes('caveat')) {
    return FONT_BY_ID.caveat.family
  }
  if (lower.includes('montserrat') || lower.includes('geometric')) {
    return FONT_BY_ID.montserrat.family
  }
  if (lower.includes('space grotesk') || lower.includes('tech')) {
    return FONT_BY_ID['space-grotesk'].family
  }
  if (lower.includes('oswald') || lower.includes('uppercase')) {
    return FONT_BY_ID.oswald.family
  }
  if (lower.includes('raleway') || lower.includes('elegant')) {
    return FONT_BY_ID.raleway.family
  }
  if (lower.includes('poppins')) return FONT_BY_ID.poppins.family
  return FONT_BY_ID.poppins.family
}

export const fontFamilyToId = (family) => {
  if (!family) return 'quicksand'
  const match = CANVAS_FONTS.find((f) => family.includes(f.label))
  return match?.id || 'quicksand'
}
