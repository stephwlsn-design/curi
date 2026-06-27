const slug = (value) => String(value || 'trends').toLowerCase().replace(/[^a-z0-9]+/g, '');

const buildFallbackTrends = (brandProfile = {}, industry = 'General') => {
  const ind = industry || brandProfile.industry || 'your industry';
  const name = brandProfile.name || 'your brand';
  const audience = brandProfile.audience || 'your audience';
  const base = slug(ind);

  return [
    {
      topic: `${ind} trends shaping buyer decisions in 2026`,
      platform: 'linkedin',
      relevance: 92,
      contentIdea: `Publish a POV carousel on how ${name} helps ${audience} navigate the top shifts in ${ind}.`,
      hashtags: [base, 'trends2026', 'thoughtleadership'],
    },
    {
      topic: `Short-form hooks that perform in ${ind}`,
      platform: 'twitter',
      relevance: 86,
      contentIdea: `Test 3 hook formulas: myth-bust, before/after, and contrarian take — tied to ${name}'s expertise.`,
      hashtags: [base, 'contentstrategy', 'socialmedia'],
    },
    {
      topic: `Community conversations in ${ind}`,
      platform: 'reddit',
      relevance: 81,
      contentIdea: `Answer the questions ${audience} asks most often with practical tips from ${name}.`,
      hashtags: [base, 'community', 'howto'],
    },
    {
      topic: `Visual storytelling formats winning in ${ind}`,
      platform: 'linkedin',
      relevance: 78,
      contentIdea: `Create a swipeable carousel: problem → insight → proof → CTA for ${name}.`,
      hashtags: [base, 'carousel', 'brandstory'],
    },
    {
      topic: `AI-assisted workflows for ${ind} marketers`,
      platform: 'twitter',
      relevance: 74,
      contentIdea: `Share a behind-the-scenes workflow post showing how ${name} plans and ships content faster.`,
      hashtags: [base, 'aimarketing', 'workflow'],
    },
  ];
};

const buildFallbackCompetitorAnalysis = (brandProfile = {}, competitorName = 'Category leader') => {
  const name = brandProfile.name || 'your brand';
  const industry = brandProfile.industry || 'your category';

  return {
    competitor: competitorName,
    score: 68,
    strengths: [
      'Strong brand recognition in the category',
      'Consistent publishing cadence across social channels',
      'Clear product positioning on key landing pages',
    ],
    weaknesses: [
      'Limited differentiation in visual identity',
      'Fewer educational formats for mid-funnel audiences',
      'Opportunity to own more niche topics in search and social',
    ],
    contentStrategy: `${competitorName} leans on broad awareness content in ${industry}. ${name} can win by publishing sharper POV pieces, proof-led case studies, and platform-native formats competitors underuse.`,
    recommendations: [
      { action: `Publish a weekly ${industry} insight series with a distinct visual system for ${name}`, impact: 'high', priority: 1 },
      { action: 'Target competitor keyword gaps with carousel and short-video explainers', impact: 'high', priority: 2 },
      { action: 'Add social proof and customer outcomes to top-of-funnel posts', impact: 'medium', priority: 3 },
      { action: 'Repurpose one long-form asset into 8–10 platform-native snippets weekly', impact: 'medium', priority: 4 },
    ],
  };
};

module.exports = {
  buildFallbackTrends,
  buildFallbackCompetitorAnalysis,
};
