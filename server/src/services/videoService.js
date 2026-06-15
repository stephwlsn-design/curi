const { generateJSON } = require('./llmService');

const buildVideoPrompt = ({ brandProfile, prompt, videoType, style, voice, count, duration }) => ({
  system: `You are Curi Video — an AI video director for short-form and long-form content.

Brand: ${brandProfile?.name || 'Brand'}
Industry: ${brandProfile?.industry || 'General'}
Voice: ${brandProfile?.voice || 'professional'}
Audience: ${brandProfile?.audience || 'General'}

Return ONLY valid JSON.`,
  user: `Brief: ${prompt}
Video Type: ${videoType}
Style Preset: ${style}
AI Voice: ${voice}
Target Duration: ${duration} seconds

Generate ${count} distinct video variant scripts with full scene breakdowns.

Return JSON:
{
  "videos": [
    {
      "title": "Video variant name",
      "hook": "first 3 second hook script",
      "scenes": [
        { "label": "Scene 1", "duration": 5, "script": "...", "visual": "visual direction" }
      ],
      "cta": "call to action script",
      "outro": "outro script",
      "captions": ["caption line 1", "caption line 2"],
      "highlightWords": ["word1", "word2"],
      "musicMood": "upbeat|dramatic|calm|energetic",
      "voiceDirection": "how to deliver",
      "platforms": ["tiktok", "instagram", "youtube"],
      "engagementScore": 88,
      "brandScore": 92,
      "conversionScore": 80,
      "platformScore": 85
    }
  ]
}`,
});

const generateVideos = async ({
  brandProfile,
  prompt,
  videoType,
  style = 'professional',
  voice = 'professional',
  variantCount = 5,
  duration = 30,
}) => {
  const count = Math.min(Math.max(variantCount, 1), 10);
  const { system, user } = buildVideoPrompt({
    brandProfile, prompt, videoType, style, voice, count, duration,
  });

  const parsed = await generateJSON({ system, user, temperature: 0.85, label: 'Video' });
  return (parsed.videos || []).map((v, i) => ({
    ...v,
    id: `video-${Date.now()}-${i}`,
    videoType,
    style,
    voice,
    duration,
    scores: {
      engagement: v.engagementScore ?? 80,
      brand: v.brandScore ?? 85,
      conversion: v.conversionScore ?? 75,
      platform: v.platformScore ?? 82,
      overall: Math.round(((v.engagementScore || 80) + (v.brandScore || 85) + (v.conversionScore || 75) + (v.platformScore || 82)) / 4),
    },
  }));
};

module.exports = { generateVideos };
