const { generateJSON } = require('./llmService');
const { CHANNELS, DIMENSIONS } = require('../constants/creative');
const { normalizeDesignIdea } = require('../utils/designIdea');

const scoreDesign = (design) => ({
  engagement: design.engagementScore ?? Math.floor(70 + Math.random() * 25),
  brand: design.brandScore ?? Math.floor(75 + Math.random() * 20),
  conversion: design.conversionScore ?? Math.floor(65 + Math.random() * 30),
  platform: design.platformScore ?? Math.floor(70 + Math.random() * 25),
  overall: design.overallScore ?? Math.floor(72 + Math.random() * 23),
});

const buildDesignIdeaSection = (designIdea) => {
  const idea = normalizeDesignIdea(designIdea);
  if (!idea.notes && !idea.hasImage) return { text: '', imagePath: null };

  let text = '\n\nUPLOADED DESIGN IDEA (treat as primary creative direction — match layout mood, colors, typography, and hierarchy):\n';
  if (idea.notes) text += `Creative notes: ${idea.notes}\n`;
  if (idea.hasImage) {
    text += 'A reference image is attached. Analyze it and align every variation with its visual style, composition, and brand feel.\n';
  }
  return { text, imagePath: idea.imagePath };
};

const resolveDesignIdeaContext = async (designIdea) => {
  const idea = normalizeDesignIdea(designIdea);
  if (!idea.notes && !idea.hasImage) return null;

  if (designIdea?.analyzedSpec && designIdea.analyzedSpec.aestheticOnly && (designIdea?.analyzedDirection || !idea.hasImage)) {
    return {
      direction: designIdea.analyzedDirection || idea.notes,
      imagePath: idea.imagePath,
      imageUrl: idea.imageUrl,
      spec: designIdea.analyzedSpec,
    };
  }

  if (!idea.hasImage) {
    return { direction: idea.notes, imagePath: null, imageUrl: null, spec: null };
  }

  const parsed = await generateJSON({
    system: `You are a senior creative director reverse-engineering a reference design into reusable AESTHETIC specs only.
Study the attached reference image precisely. Return ONLY valid JSON.

CRITICAL RULES:
- IGNORE all text, headlines, body copy, logos with words, and CTAs visible in the reference.
- Do NOT transcribe, quote, or reproduce any words from the image.
- Extract ONLY visual aesthetics: color palette, gradients, composition rhythm, spacing, shapes, mood, and typography STYLE (weight, feel — not content).
- Placements describe where NEW user copy should go — not where existing reference text is.`,
    user: `Analyze this reference design for aesthetic reproduction WITHOUT any of its text content.
User notes: ${idea.notes || 'None'}

Extract visual specs so new designs share the same LOOK (colors, layout style, typography mood) with completely different copy.

Return JSON:
{
  "direction": "2-3 sentences describing aesthetic style only — no text from the image",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "layout": "centered|split|grid|hero|minimal",
  "textColor": "#hex",
  "subtextColor": "#hex or rgba",
  "ctaBackground": "#hex",
  "ctaTextColor": "#hex",
  "overlayOpacity": 0.12,
  "textureOpacity": 0.2,
  "gradientAngle": 135,
  "typography": "description of font style only",
  "placements": {
    "headline": { "x": 0.08, "y": 0.32, "width": 0.84, "align": "center|left|right", "fontSize": 48 },
    "subheadline": { "x": 0.1, "y": 0.48, "width": 0.8, "align": "center", "fontSize": 22 },
    "cta": { "x": 0.32, "y": 0.72, "width": 0.36, "fontSize": 14 }
  }
}`,
    temperature: 0.3,
    label: 'Design Idea Analysis',
    imagePath: idea.imagePath,
    timeoutMs: 22000,
  });

  const spec = {
    colorPalette: parsed.colorPalette || ['#FF6B9D', '#4DA8EE', '#1A2B48'],
    layout: parsed.layout || 'centered',
    textColor: parsed.textColor || '#ffffff',
    subtextColor: parsed.subtextColor || 'rgba(255,255,255,0.85)',
    ctaBackground: parsed.ctaBackground || '#ffffff',
    ctaTextColor: parsed.ctaTextColor || '#1A2B48',
    overlayOpacity: parsed.overlayOpacity ?? 0.12,
    textureOpacity: parsed.textureOpacity ?? 0.2,
    gradientAngle: parsed.gradientAngle ?? 135,
    typography: parsed.typography || 'bold sans-serif',
    placements: parsed.placements || null,
    aestheticOnly: true,
  };

  const direction = [parsed.direction, idea.notes ? `User notes: ${idea.notes}` : ''].filter(Boolean).join('\n');
  return { direction, imagePath: idea.imagePath, imageUrl: idea.imageUrl, spec };
};

const applyDesignIdeaToDesign = (design, ideaContext) => {
  if (!ideaContext?.spec && !ideaContext?.imageUrl) return design;
  const { spec, imageUrl } = ideaContext;
  return {
    ...design,
    layout: spec?.layout || design.layout,
    colorPalette: spec?.colorPalette || design.colorPalette,
    typography: spec?.typography || design.typography,
    referenceImageUrl: imageUrl || design.referenceImageUrl,
    designIdeaApplied: true,
    compositionNotes: ideaContext.direction
      ? `Based on uploaded reference: ${ideaContext.direction.slice(0, 200)}`
      : design.compositionNotes,
  };
};

const buildDesignPrompt = ({
  brandProfile,
  prompt,
  creativeType,
  channels,
  dim,
  channelSpecs,
  count,
  style,
  collectionMode,
  designIdeaSection = '',
}) => ({
  system: `You are Curi Design — an AI creative director generating high-converting visual design specs.

Brand: ${brandProfile?.name || 'Brand'}
Industry: ${brandProfile?.industry || 'General'}
Voice: ${brandProfile?.voice || 'professional'}
Audience: ${brandProfile?.audience || 'General'}
Colors: ${JSON.stringify(brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#FFD154'])}

Return ONLY valid JSON.`,
  user: `Brief: ${prompt}
Creative Type: ${creativeType}
Style Preset: ${style}
Dimensions: ${dim.width}x${dim.height}
Target Channels: ${channels.join(', ')}
Channel Rules: ${JSON.stringify(channelSpecs)}${designIdeaSection}

Generate exactly ${count} distinct design variations${collectionMode ? ' as a cohesive collection (Collection A style)' : ''}.

Return JSON:
{
  "collectionName": "string",
  "designs": [
    {
      "name": "Design 1",
      "headline": "main headline text",
      "subheadline": "supporting text",
      "cta": "button text",
      "layout": "split|centered|grid|hero|minimal",
      "typography": "font style description",
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "visualElements": ["element descriptions"],
      "compositionNotes": "why this layout converts",
      "engagementScore": 85,
      "brandScore": 90,
      "conversionScore": 78,
      "platformScore": 88,
      "overallScore": 85
    }
  ]
}`,
});

const generateDesigns = async ({
  brandProfile,
  prompt,
  creativeType,
  channels = ['instagram'],
  dimensionId = '1080x1080',
  variantCount = 5,
  style = 'modern',
  collectionMode = false,
  designIdea = null,
  designIdeaContext = null,
}) => {
  const count = Math.min(Math.max(variantCount, 1), 10);
  const dim = DIMENSIONS.find(d => d.id === dimensionId) || DIMENSIONS[0];
  const channelSpecs = channels.map(c => CHANNELS[c]).filter(Boolean);

  let ideaSection = '';
  let imagePath = null;
  if (designIdeaContext?.direction) {
    const refNote = designIdeaContext.imageUrl
      ? `\n\nREFERENCE IMAGE ATTACHED — CRITICAL INSTRUCTIONS:
- Replicate the reference image's visual style, color palette, layout hierarchy, and typography mood EXACTLY.
- Use the reference as the design template; only change headline/subheadline/CTA copy per the brief.
- colorPalette MUST match the reference: ${JSON.stringify(designIdeaContext.spec?.colorPalette || [])}
- layout MUST be: ${designIdeaContext.spec?.layout || 'as shown in reference'}
- Visual analysis: ${designIdeaContext.direction}\n`
      : `\n\nUPLOADED DESIGN IDEA (primary creative direction):\n${designIdeaContext.direction}\n`;
    ideaSection = refNote;
    imagePath = designIdeaContext.imagePath || null;
  } else if (designIdea) {
    const section = buildDesignIdeaSection(designIdea);
    ideaSection = section.text;
    imagePath = section.imagePath;
  }

  const parsed = await generateJSON({
    system: imagePath
      ? `${buildDesignPrompt({ brandProfile, prompt, creativeType, channels, dim, channelSpecs, count, style, collectionMode, designIdeaSection: '' }).system}

When a reference image is attached, every design variation must visually match that reference — same palette, layout structure, and composition. Only vary the marketing copy.`
      : buildDesignPrompt({
        brandProfile, prompt, creativeType, channels, dim, channelSpecs,
        count, style, collectionMode, designIdeaSection: ideaSection,
      }).system,
    user: buildDesignPrompt({
      brandProfile, prompt, creativeType, channels, dim, channelSpecs,
      count, style, collectionMode, designIdeaSection: ideaSection,
    }).user,
    temperature: imagePath ? 0.65 : 0.85,
    label: 'Design',
    imagePath,
  });
  const designs = (parsed.designs || []).map((d, i) => {
    const enriched = designIdeaContext ? applyDesignIdeaToDesign(d, designIdeaContext) : d;
    return {
      ...enriched,
      id: `design-${Date.now()}-${i}`,
      creativeType,
      style,
      dimensions: dim,
      channels,
      scores: scoreDesign(enriched),
      designIdeaApplied: Boolean(ideaSection || designIdeaContext),
    };
  });

  return {
    collectionName: parsed.collectionName || (ideaSection ? 'Design Idea Collection' : 'Design Collection'),
    designs,
  };
};

module.exports = { generateDesigns, scoreDesign, resolveDesignIdeaContext, applyDesignIdeaToDesign };
