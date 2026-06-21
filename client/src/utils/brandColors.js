const normalizeHex = (value) => {
  if (!value || typeof value !== 'string') return null
  let hex = value.trim()
  if (!hex.startsWith('#')) hex = `#${hex}`
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null
}

const countColors = (values) => {
  const counts = new Map()
  values.forEach((raw) => {
    const hex = normalizeHex(raw)
    if (!hex) return
    counts.set(hex, (counts.get(hex) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([hex, count]) => ({ hex, count }))
}

export const buildBrandColorSummary = ({ brandProfile, designs = [] }) => {
  const palette = (brandProfile?.colors?.palette || brandProfile?.onboarding?.brandColors || [])
    .map(normalizeHex)
    .filter(Boolean)

  const named = {
    primary: normalizeHex(brandProfile?.colors?.primary),
    secondary: normalizeHex(brandProfile?.colors?.secondary),
    accent: normalizeHex(brandProfile?.colors?.accent),
    background: normalizeHex(brandProfile?.colors?.background),
    text: normalizeHex(brandProfile?.colors?.text),
  }

  const designPalette = []
  designs.forEach((d) => {
    const colors = d.colorPalette || d.metadata?.colorPalette || []
    if (Array.isArray(colors)) designPalette.push(...colors)
  })

  const fromDesigns = countColors(designPalette)
  const fromBrand = countColors([
    ...palette,
    named.primary,
    named.secondary,
    named.accent,
    named.background,
    named.text,
  ].filter(Boolean))

  const merged = new Map()
  fromBrand.forEach(({ hex, count }) => merged.set(hex, { hex, brandCount: count, designCount: 0 }))
  fromDesigns.forEach(({ hex, count }) => {
    const existing = merged.get(hex) || { hex, brandCount: 0, designCount: 0 }
    existing.designCount = count
    merged.set(hex, existing)
  })

  const ranked = [...merged.values()]
    .map((row) => ({
      ...row,
      total: row.brandCount + row.designCount,
      source: row.brandCount && row.designCount ? 'brand+designs' : row.brandCount ? 'brand' : 'designs',
    }))
    .sort((a, b) => b.total - a.total || b.brandCount - a.brandCount)

  return {
    palette: fromBrand.map((c) => c.hex),
    named,
    ranked,
    hasColors: ranked.length > 0,
  }
}
