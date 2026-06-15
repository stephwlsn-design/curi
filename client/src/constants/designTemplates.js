/** Canvas element layout presets — positions are % of canvas width/height */

export const BUILTIN_TEMPLATES = [
  {
    id: 'centered-hero',
    name: 'Centered Hero',
    description: 'Bold headline centered with CTA below',
    category: 'social',
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
    description: 'Copy aligned left, CTA bottom-left',
    category: 'social',
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
    description: 'All content anchored to the bottom',
    category: 'social',
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
    description: 'Clean headline at top, open space below',
    category: 'minimal',
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
    description: 'Optimized for 9:16 story format',
    category: 'story',
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
    description: 'High-contrast ad layout with prominent CTA',
    category: 'ads',
    placements: {
      badge: { x: 0.04, y: 0.04, width: 0.24 },
      headline: { x: 0.05, y: 0.2, width: 0.9, align: 'left', fontSize: 56 },
      subheadline: { x: 0.05, y: 0.42, width: 0.75, align: 'left', fontSize: 22 },
      cta: { x: 0.55, y: 0.75, width: 0.38 },
    },
  },
]

export const LAYOUT_TO_TEMPLATE = {
  centered: 'centered-hero',
  split: 'split-left',
  grid: 'bottom-stack',
  hero: 'centered-hero',
  minimal: 'minimal-top',
}
