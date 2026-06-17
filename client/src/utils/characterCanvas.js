import characters from '../../../shared/animatedCharacters.json'

export const ANIMATED_CHARACTERS = characters

export const CHARACTER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'mascots', label: '3D Mascots' },
  { id: 'people', label: 'People' },
  { id: 'celebration', label: 'Celebration' },
  { id: 'business', label: 'Business' },
  { id: 'tech', label: 'Tech' },
  { id: 'cute', label: 'Cute' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'brand', label: 'Brand' },
]

export const searchCharacters = (query, category = 'all') => {
  const q = query.trim().toLowerCase()
  return ANIMATED_CHARACTERS.filter((c) => {
    if (category !== 'all' && c.category !== category) return false
    if (!q) return true
    const haystack = [c.name, c.category, c.style, ...(c.tags || [])].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

export const applyCharacterToCanvas = (canvas, character, position = 'bottom-right') => {
  const w = canvas.width
  const h = canvas.height
  const elW = Math.round(w * (character.defaultWidth || 0.3))
  const elH = elW

  const positions = {
    'bottom-right': { x: w - elW - Math.round(w * 0.05), y: h - elH - Math.round(h * 0.06) },
    'bottom-left': { x: Math.round(w * 0.05), y: h - elH - Math.round(h * 0.06) },
    'center': { x: Math.round((w - elW) / 2), y: Math.round((h - elH) / 2) },
    'top-right': { x: w - elW - Math.round(w * 0.05), y: Math.round(h * 0.06) },
  }
  const pos = positions[position] || positions['bottom-right']

  const id = `character-${character.id}-${Date.now()}`
  return {
    ...canvas,
    elements: [
      ...canvas.elements,
      {
        id,
        type: 'character',
        characterId: character.id,
        url: character.assetUrl,
        previewUrl: character.previewUrl,
        animated: character.animated !== false,
        name: character.name,
        x: pos.x,
        y: pos.y,
        width: elW,
        height: elH,
        visible: true,
        zIndex: 8,
      },
    ],
  }
}

export const applyTalkingCharacterToCanvas = (canvas, payload, position = 'center') => {
  const w = canvas.width
  const h = canvas.height
  const elW = Math.round(w * (payload.defaultWidth || 0.55))
  const elH = Math.round(elW * 1.05)

  const positions = {
    'bottom-right': { x: w - elW - Math.round(w * 0.05), y: h - elH - Math.round(h * 0.06) },
    'bottom-left': { x: Math.round(w * 0.05), y: h - elH - Math.round(h * 0.06) },
    center: { x: Math.round((w - elW) / 2), y: Math.round((h - elH) / 2) },
    'top-right': { x: w - elW - Math.round(w * 0.05), y: Math.round(h * 0.06) },
  }
  const pos = positions[position] || positions.center

  const id = `talking-${Date.now()}`
  return {
    ...canvas,
    elements: [
      ...canvas.elements,
      {
        id,
        type: 'talking-character',
        characterId: payload.characterId || null,
        url: payload.imageUrl,
        posterUrl: payload.imageUrl,
        videoUrl: payload.videoUrl || null,
        audioDataUrl: payload.audioDataUrl || null,
        name: payload.name || 'Talking Character',
        script: payload.script || '',
        language: payload.language || 'en',
        tonality: payload.tonality || 'friendly',
        gender: payload.gender || 'female',
        videoSpeed: payload.videoSpeed || 1,
        speakTrigger: payload.speakTrigger || null,
        x: pos.x,
        y: pos.y,
        width: elW,
        height: elH,
        visible: true,
        zIndex: 9,
      },
    ],
  }
}
