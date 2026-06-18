const DURATION_PLANS = {
  30: {
    label: '30-day sprint',
    phases: [
      { name: 'Days 1–7: Launch & awareness', focus: 'Introduce the brand POV, establish credibility, hook new audiences' },
      { name: 'Days 8–14: Education & value', focus: 'Teach, demystify, share frameworks and proof points' },
      { name: 'Days 15–21: Engagement & community', focus: 'Conversations, social proof, UGC-style prompts, polls' },
      { name: 'Days 22–30: Conversion & momentum', focus: 'Offers, case studies, strong CTAs, recap the month' },
    ],
    weeklyThemes: 4,
  },
  60: {
    label: '60-day growth arc',
    phases: [
      { name: 'Days 1–15: Brand foundation', focus: 'Who we are, who we serve, category POV' },
      { name: 'Days 16–30: Authority building', focus: 'Deep expertise, comparisons, thought leadership' },
      { name: 'Days 31–45: Social proof & stories', focus: 'Customers, results, behind-the-scenes, team' },
      { name: 'Days 46–60: Scale & convert', focus: 'Campaigns, launches, partnerships, retention' },
    ],
    weeklyThemes: 8,
  },
  90: {
    label: '90-day quarterly plan',
    phases: [
      { name: 'Month 1: Discover & trust', focus: 'Awareness, education, brand story, top-of-funnel' },
      { name: 'Month 2: Engage & differentiate', focus: 'Unique POV, product depth, competitor contrast' },
      { name: 'Month 3: Convert & retain', focus: 'Offers, events, milestones, community, renewal' },
    ],
    weeklyThemes: 12,
  },
};

const getDurationPlan = (days) => DURATION_PLANS[days] || {
  label: `${days}-day campaign`,
  phases: [
    { name: `Days 1–${Math.ceil(days / 3)}`, focus: 'Awareness and education' },
    { name: `Days ${Math.ceil(days / 3) + 1}–${Math.ceil(days * 2 / 3)}`, focus: 'Engagement and proof' },
    { name: `Days ${Math.ceil(days * 2 / 3) + 1}–${days}`, focus: 'Conversion and momentum' },
  ],
  weeklyThemes: Math.min(12, Math.ceil(days / 7)),
};

const CHANNEL_GUIDANCE = {
  linkedin: 'Professional insight, thought leadership, carousels, industry takes, hiring/team posts',
  instagram: 'Visual storytelling, reels, carousels, behind-the-scenes, lifestyle brand moments',
  twitter: 'Sharp hooks, threads, news reactions, concise opinions, conversation starters',
  tiktok: 'Short-form education, trends, personality, hooks in first 2 seconds',
  facebook: 'Community updates, events, longer captions, local/social proof',
};

const buildBrandBrief = (brandProfile = {}, onboarding = {}, compact = false) => {
  const name = brandProfile.name || onboarding.companyName || 'the brand';
  if (compact) {
    return `Brand: ${name} | Industry: ${brandProfile.industry || 'General'} | Voice: ${brandProfile.voice || onboarding.brandVoice || 'professional'} | Audience: ${brandProfile.audience || onboarding.targetAudience || 'professionals'} | Value: ${(brandProfile.valueProposition || '').slice(0, 120)} | Keywords: ${(brandProfile.keywords || []).slice(0, 6).join(', ')}`;
  }

  const palette = brandProfile.colors?.palette?.length
    ? brandProfile.colors.palette.join(', ')
    : [brandProfile.colors?.primary, brandProfile.colors?.secondary, brandProfile.colors?.accent]
      .filter(Boolean).join(', ');

  return `
## Brand identity
- **Name:** ${name}
- **Website:** ${brandProfile.url || onboarding.website || 'not provided'}
- **Industry:** ${brandProfile.industry || 'General'}
- **Brand voice:** ${brandProfile.voice || onboarding.brandVoice || 'professional'}
- **Target audience:** ${brandProfile.audience || onboarding.targetAudience || 'Business professionals'}
- **Value proposition:** ${brandProfile.valueProposition || 'Not specified — infer from industry and products'}
- **Products & services:** ${(brandProfile.products || []).join('; ') || 'Infer from marketing summary'}
- **Keywords & themes:** ${(brandProfile.keywords || []).join(', ') || 'Use industry-standard terms'}
- **Competitors to differentiate from:** ${(brandProfile.competitors || onboarding.competitors || []).join(', ') || 'Category leaders'}
- **Marketing summary:** ${brandProfile.marketingSummary || 'Build a coherent narrative from available brand data'}
- **Visual identity:** ${palette || 'Modern, on-brand palette'}
- **Typography:** ${brandProfile.fonts?.heading || 'Sans-serif'} / ${brandProfile.fonts?.body || 'Sans-serif'}
`.trim();
};

const buildStrategyPrompt = ({
  brandProfile,
  onboarding,
  topics,
  days,
  channels,
  preferences,
  designIdea,
  maxEntries,
  compact = false,
}) => {
  if (compact) {
    const system = `You are a content strategist. Return ONLY valid JSON. Formats: post, carousel, story, video, reel. Channels: ${channels.join(', ')}.`;
    const user = `Create a ${days}-day plan for ${brandProfile?.name || onboarding?.companyName || 'this brand'}.
${buildBrandBrief(brandProfile, onboarding, true)}
Channels: ${channels.join(', ')}. Topics: ${topics.slice(0, 10).map((t) => t.topic).join(', ')}.
Generate exactly ${maxEntries} items spread across days 1-${days}. Each item must be brand-specific.
Return JSON: {"name":"...","campaignGoal":"...","narrative":"...","contentPillars":["..."],"phases":[{"name":"...","dayRange":"1-7","focus":"..."}],"channelStrategy":"...","clusters":[],"items":[{"day":1,"topic":"...","angle":"...","goal":"awareness","pillar":"...","channel":"linkedin","format":"carousel","publishTime":"09:00","priority":1}]}`;
    return { system, user };
  }

  const duration = getDurationPlan(days);
  const palette = brandProfile.colors?.palette?.length
    ? brandProfile.colors.palette.join(', ')
    : [brandProfile.colors?.primary, brandProfile.colors?.secondary, brandProfile.colors?.accent]
      .filter(Boolean).join(', ');

  const phaseBlock = duration.phases
    .map((p) => `- **${p.name}** — ${p.focus}`)
    .join('\n');

  const channelBlock = channels
    .map((ch) => `- **${ch}:** ${CHANNEL_GUIDANCE[ch] || 'On-brand native content'}`)
    .join('\n');

  const topicBlock = topics.slice(0, 20).map((t, i) => (
    `${i + 1}. ${t.topic} (relevance ${t.relevance || 80}%, source: ${t.source || 'discovery'})`
  )).join('\n');

  const prefBlock = preferences
    ? `Preferred styles: ${preferences.styles?.map((s) => s.name).join(', ') || 'modern'}
Preferred formats: ${preferences.formats?.map((f) => f.name).join(', ') || 'mixed'}`
    : 'No prior performance preferences — optimize for engagement and brand fit.';

  const designBlock = designIdea?.notes || designIdea?.analyzedDirection
    ? `Design direction from uploaded brief: ${designIdea.analyzedDirection || designIdea.notes}`
    : '';

  const system = `You are a senior content strategist and campaign planner for Curi Autonomous Content Engine.
You create bespoke, executable content plans — not generic calendars.
Every calendar item must be specific to THIS brand, THIS audience, and THIS ${days}-day window.
Return ONLY valid JSON matching the schema exactly.
Use format values exactly: post, carousel, story, video, reel.
Use channel values exactly: ${channels.join(', ')}.`;

  const user = `
# Mission
Design a **${duration.label}** content plan for **${brandProfile?.name || onboarding?.companyName || 'this brand'}**.
Produce exactly **${maxEntries}** calendar items spread across **days 1–${days}** (use the full timeline — do not cluster everything in week 1).
Each item must feel custom-written for this brand — no generic "5 tips for success" filler.

${buildBrandBrief(brandProfile, onboarding)}

## Campaign duration: ${days} days
${phaseBlock}

## Channels to plan for
${channelBlock}

## Discovered topics (prioritize high-relevance; combine and angle for this brand)
${topicBlock || 'Generate topics from brand profile and industry.'}

## Learned preferences
${prefBlock}
${designBlock ? `\n## Creative direction\n${designBlock}` : ''}

## Planning rules
1. **Brand-fit:** Every topic, angle, and CTA must reflect the brand voice (${brandProfile?.voice || 'professional'}) and speak to ${brandProfile?.audience || 'the target audience'}.
2. **Duration arc:** Map items to the phase structure above — early days = awareness/education, later days = proof/conversion.
3. **Channel-native:** Match format to channel (e.g. carousels on LinkedIn/Instagram, reels on Instagram/TikTok, threads on Twitter).
4. **Variety:** Mix formats across the plan; no more than 2 consecutive items with the same format.
5. **Differentiation:** Where competitors are known, angle content to highlight this brand's unique value proposition.
6. **Publish times:** Use realistic times per channel (LinkedIn 8–9am, Instagram 11am–1pm, Twitter noon, TikTok evening).
7. **Spacing:** Distribute days evenly across 1–${days}; include items in the final third of the campaign, not only the start.

## Output JSON schema
{
  "name": "Descriptive campaign name referencing brand + duration",
  "campaignGoal": "One clear sentence — what this ${days}-day plan achieves for the brand",
  "narrative": "2–3 sentences describing the story arc across all ${days} days",
  "contentPillars": ["3–5 pillars tailored to this brand, e.g. 'Customer proof', 'Category education'"],
  "phases": [{ "name": "Phase name", "dayRange": "1-7", "focus": "What this phase accomplishes" }],
  "channelStrategy": "2–3 sentences on how each selected channel serves this brand for this duration",
  "clusters": [{ "name": "Theme cluster name", "topics": ["..."], "channels": ["linkedin"] }],
  "items": [{
    "day": 1,
    "topic": "Specific post topic — not generic",
    "angle": "The unique hook or POV for this brand",
    "goal": "awareness|education|engagement|conversion|trust",
    "pillar": "Which content pillar this supports",
    "channel": "linkedin",
    "format": "carousel",
    "publishTime": "09:00",
    "priority": 1
  }]
}

Generate exactly ${maxEntries} items in the items array.`;

  return { system, user };
};

module.exports = {
  buildStrategyPrompt,
  buildBrandBrief,
  getDurationPlan,
  CHANNEL_GUIDANCE,
};
