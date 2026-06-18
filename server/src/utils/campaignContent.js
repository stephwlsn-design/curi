const { getDurationPlan } = require('./strategyPrompt');

const STOP_WORDS = new Set([
  'about', 'after', 'also', 'and', 'are', 'based', 'been', 'being', 'both', 'but', 'can',
  'content', 'could', 'focus', 'for', 'from', 'have', 'help', 'into', 'just', 'more', 'our',
  'should', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'through', 'using', 'want', 'what', 'when', 'which', 'while', 'will', 'with', 'your',
]);

const extractBriefKeywords = (brief = '') => {
  const text = String(brief).trim();
  if (!text) return [];
  const phrases = text
    .split(/[,;]|\n+|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 4 && s.length < 80);
  if (phrases.length) return [...new Set(phrases)].slice(0, 8);
  if (text.length <= 120) return [text];
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w)),
  )].slice(0, 8);
};

const extractPromptThemes = (brief = '') => {
  const text = String(brief).trim();
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 160);
  const keywords = extractBriefKeywords(text);
  const combined = [...lines, ...keywords];
  if (!combined.length) return text.length <= 200 ? [text] : [];
  return [...new Set(combined.map((s) => s.replace(/\s+/g, ' ').trim()))].filter(Boolean).slice(0, 15);
};

const subjectFromTopic = (topic = '') => {
  const t = String(topic).trim();
  const parts = t.split(' · ');
  return parts[parts.length - 1] || t;
};

const buildPlannedTopic = ({
  brandProfile, poolTopic, pillar,
}) => {
  const brand = brandProfile?.name || 'Our brand';
  const audience = brandProfile?.audience || 'your audience';
  const subject = subjectFromTopic(poolTopic?.topic || poolTopic || 'industry trends');
  const frames = {
    Education: `What ${audience} should know about ${subject}`,
    'Social proof': `How ${brand} helps ${audience} with ${subject}`,
    'Product value': `${subject}: the ${brand} approach`,
    'Thought leadership': `${brand}'s take on ${subject}`,
    Community: `Join us: ${subject} for ${audience}`,
  };
  return (frames[pillar] || `${brand} on ${subject}`).slice(0, 140);
};

const buildPlannedAngle = ({
  pillar, goal, audience, platform, poolTopic, briefKeywords = [], index = 0,
}) => {
  const subject = subjectFromTopic(poolTopic?.topic || poolTopic || 'this topic');
  const kw = briefKeywords.length ? briefKeywords[index % briefKeywords.length] : null;
  const hooks = {
    awareness: `Hook ${audience} with a surprising stat or question about ${subject}`,
    education: `Teach one practical takeaway about ${subject}`,
    engagement: `Ask ${audience} to comment with their experience`,
    conversion: `Drive a clear CTA tied to ${subject}`,
    trust: `Lead with proof — result, testimonial, or data on ${subject}`,
  };
  const base = `${hooks[goal] || hooks.education} · ${pillar} · ${platform}`;
  if (kw) return `${base} · tie to: ${kw.replace(/^focus on\s+/i, '').slice(0, 40)}`.slice(0, 180);
  return base.slice(0, 180);
};

const phaseForDay = (phases, day, days) => {
  if (!phases?.length) return null;
  for (const phase of phases) {
    const range = phase.dayRange || phase.name || '';
    const match = range.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (match) {
      const lo = Number(match[1]);
      const hi = Number(match[2]);
      if (day >= lo && day <= hi) return phase;
    }
  }
  const third = Math.ceil(days / 3);
  if (day <= third) return phases[0];
  if (day <= third * 2) return phases[Math.min(1, phases.length - 1)];
  return phases[phases.length - 1];
};

const buildItemsFromPlanBrief = ({
  planBrief,
  topics,
  days,
  channels,
  entryCount,
  brandProfile,
  contentPrompt = '',
}) => {
  const FORMATS = ['post', 'carousel', 'story', 'video', 'reel'];
  const goals = ['awareness', 'education', 'engagement', 'conversion', 'trust'];
  const count = entryCount || days;
  const themeTopics = (planBrief?.themeTopics || []).filter(Boolean);
  const promptThemes = extractPromptThemes(contentPrompt);
  const pillars = planBrief?.contentPillars?.length
    ? planBrief.contentPillars
    : ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'];
  const phases = planBrief?.phases?.length
    ? planBrief.phases
    : getDurationPlan(days).phases;
  const discovered = topics.length ? topics : [{ topic: `${brandProfile?.name || 'Brand'} update` }];
  const briefKeywords = extractBriefKeywords(contentPrompt || planBrief?.userBrief || planBrief?.summary || '');
  const briefTopics = briefKeywords.map((k) => ({ topic: String(k).trim(), fromBrief: true }));
  const topicPool = [
    ...[...new Set([...promptThemes, ...themeTopics])].map((t) => ({ topic: String(t).trim(), fromAi: true })),
    ...briefTopics,
    ...discovered.map((t) => ({ topic: t.topic, fromAi: false })),
  ].filter((t) => t.topic?.length > 3);
  const audience = brandProfile?.audience || 'your audience';

  return Array.from({ length: count }, (_, i) => {
    const day = spreadDay(i, count, days);
    const pillar = pillars[i % pillars.length];
    const goal = goals[i % goals.length];
    const channel = channels[i % channels.length] || 'linkedin';
    const poolItem = topicPool[i % topicPool.length];
    const phase = phaseForDay(phases, day, days);
    const useDirectTopic = poolItem.fromAi || poolItem.fromBrief;
    const topic = useDirectTopic
      ? String(poolItem.topic).slice(0, 140)
      : buildPlannedTopic({
        brandProfile,
        poolTopic: poolItem,
        pillar,
      }).slice(0, 140);
    let angle = useDirectTopic
      ? `${pillar} · ${poolItem.topic} · for ${audience} on ${channel}`
      : buildPlannedAngle({
        pillar,
        goal,
        audience,
        platform: channel,
        poolTopic: poolItem,
        briefKeywords,
        index: i,
      });
    if (!useDirectTopic && briefKeywords.length) {
      angle = `${briefKeywords[i % briefKeywords.length]} · ${angle}`.slice(0, 180);
    } else if (phase?.focus && useDirectTopic) {
      angle = `${poolItem.topic} · ${phase.focus}`.slice(0, 180);
    }
    return {
      day,
      topic,
      angle: angle.slice(0, 180),
      goal,
      pillar,
      channel,
      format: FORMATS[i % FORMATS.length],
      publishTime: ['09:00', '11:00', '12:00', '14:00', '17:00'][i % 5],
      priority: i + 1,
    };
  });
};

const spreadDay = (index, total, days) => {
  if (total <= 1) return 1;
  return Math.max(1, Math.min(days, Math.round(((index + 1) / total) * days)));
};

const buildPlanNarrative = ({ brandProfile, days, entryCount, brief, visual, channels = [] }) => {
  const brand = brandProfile?.name || 'the brand';
  const kws = extractBriefKeywords(brief);
  const themeLine = kws.length
    ? `Themes woven in: ${kws.slice(0, 3).join(', ')}.`
    : '';
  return [
    `A ${days}-day, ${entryCount}-post calendar for ${brand}.`,
    themeLine,
    visual ? `Visual style follows the uploaded reference.` : '',
    `Channels: ${channels.length ? channels.join(', ') : 'mixed'}.`,
  ].filter(Boolean).join(' ');
};

const composeAutonomousPost = ({ entry, brandProfile, platform, campaignBrief = '' }) => {
  const brand = brandProfile?.name || 'We';
  const audience = brandProfile?.audience || 'professionals';
  const vp = brandProfile?.valueProposition?.trim() || '';
  const topic = entry.topic || 'Industry update';
  const subject = subjectFromTopic(topic);
  const keywords = extractBriefKeywords(campaignBrief);
  const day = entry.day || 1;
  const themeHint = keywords[(day - 1) % Math.max(keywords.length, 1)] || keywords[0] || null;
  const strategyAngle = entry.angle || entry.caption || '';
  const kws = (brandProfile.keywords || []).slice(0, 4);

  if (campaignBrief.trim() && topic) {
    const focusLine = themeHint
      ? `This post is part of our focus on ${themeHint}.`
      : '';
    const detail = strategyAngle
      ? strategyAngle.split(' · ').filter((seg) => seg.trim() && seg !== topic).join(' · ').slice(0, 220)
      : (vp || `${brand} helps ${audience} with ${subject}.`);
    if (platform === 'instagram') {
      return {
        content: `${topic} ✨\n\n${detail}\n\n${focusLine}\n\nTap follow for more from ${brand}.`.replace(/\n\n\n/g, '\n\n').trim(),
        hashtags: (kws.length ? kws : [brand.replace(/\s+/g, ''), 'content']).slice(0, 8),
      };
    }
    if (platform === 'twitter') {
      return {
        content: `${topic}${themeHint ? ` — ${themeHint}` : ''}\n\n${detail}`.slice(0, 280),
        hashtags: (kws.length ? kws : [brand.replace(/\s+/g, '')]).slice(0, 3),
      };
    }
    return {
      content: `${topic}\n\n${detail}\n\n${focusLine}\n\nWhat's your perspective?`.replace(/\n\n\n/g, '\n\n').trim(),
      hashtags: (kws.length ? kws : [brand.replace(/\s+/g, ''), 'marketing']).slice(0, 5),
    };
  }

  const angleHook = strategyAngle.split(' · ')[0]?.trim();
  const briefLine = themeHint ? `This ties into our focus on ${themeHint}.` : '';

  if (strategyAngle && angleHook) {
    const angleBody = strategyAngle.includes(' · ')
      ? strategyAngle.split(' · ').slice(1).join(' · ').slice(0, 200)
      : vp;
    if (platform === 'instagram') {
      return {
        content: `${topic} ✨\n\n${angleHook}\n\n${angleBody || vp || `Built for ${audience}.`}\n\n${briefLine}`.trim(),
        hashtags: (kws.length ? kws : [brand.replace(/\s+/g, ''), 'content']).slice(0, 8),
      };
    }
    if (platform === 'twitter') {
      return {
        content: `${angleHook}\n\n${topic}${themeHint ? ` · ${themeHint}` : ''}`.slice(0, 280),
        hashtags: (kws.length ? kws : [brand.replace(/\s+/g, '')]).slice(0, 3),
      };
    }
    return {
      content: `${topic}\n\n${angleHook}\n\n${angleBody || vp || `${brand} helps ${audience} with ${subject}.`}\n\n${briefLine}\n\nWhat's your take?`.trim(),
      hashtags: (kws.length ? kws : [brand.replace(/\s+/g, ''), 'marketing']).slice(0, 5),
    };
  }

  const linkedinBodies = [
    `${topic}\n\n${vp || `${brand} helps ${audience} move faster with clearer market intelligence.`}\n\nOne thing we're seeing: teams that act on ${subject} early outperform peers.\n\nWhat's your experience? Drop a comment.`,
    `Quick take for ${audience}:\n\n${topic}\n\n${vp ? `${vp}\n\n` : ''}If you're planning around ${themeHint || subject}, start with one measurable goal this week.\n\nAgree or disagree?`,
    `${topic}\n\nAt ${brand}, we talk to ${audience} every day. The pattern: the best outcomes come from combining data with a clear point of view.\n\n${vp || 'We built our platform for exactly that.'}\n\nSave this if it's useful.`,
  ];

  const instagramBodies = [
    `${topic} ✨\n\n${vp || `Built for ${audience}.`}\n\n${themeHint ? `Part of our focus on ${themeHint}. ` : ''}Tap follow for more.`,
    `${subject} — simplified.\n\n${brand} helps you cut through the noise.\n\n${vp}\n\nLink in bio.`,
    `Day ${day} of our content series 📅\n\n${topic}\n\n${vp || `Made for ${audience}.`}`,
  ];

  const twitterBodies = [
    `${topic}\n\n${vp ? `${vp.slice(0, 100)}` : `${brand} for ${audience}.`}`,
    `Hot take: ${subject} matters more than ever.\n\n${brand} → ${themeHint || 'insights that ship'}`,
    `${topic} — thread-worthy? We think so.`,
  ];

  const pick = (arr) => arr[(day + (entry._id ? String(entry._id).length : 0)) % arr.length];

  let body;
  if (platform === 'instagram') body = pick(instagramBodies);
  else if (platform === 'twitter') body = pick(twitterBodies);
  else body = pick(linkedinBodies);

  const hashtags = kws.length
    ? kws.map((k) => String(k).replace(/\s+/g, ''))
    : [brand.replace(/\s+/g, ''), 'marketing', 'content'].filter(Boolean);

  return { content: body.trim(), hashtags: hashtags.slice(0, platform === 'instagram' ? 8 : 5) };
};

const buildBriefDrivenItems = ({
  contentPrompt,
  brandProfile,
  days,
  channels,
  entryCount,
  designIdea = null,
}) => {
  const themes = extractPromptThemes(contentPrompt);
  if (!themes.length) return null;
  const FORMATS = ['post', 'carousel', 'story', 'video', 'reel'];
  const goals = ['awareness', 'education', 'engagement', 'conversion', 'trust'];
  const audience = brandProfile?.audience || 'your audience';
  const count = entryCount || days;
  const visualNote = designIdea?.analyzedDirection || designIdea?.notes || '';
  return Array.from({ length: count }, (_, i) => {
    const theme = themes[i % themes.length];
    const channel = channels[i % channels.length] || 'linkedin';
    const day = spreadDay(i, count, days);
    let angle = `${theme} · tailored for ${audience} on ${channel}`;
    if (visualNote && i % 4 === 0) {
      angle = `${angle} · match reference aesthetic`.slice(0, 180);
    }
    return {
      day,
      topic: theme.slice(0, 140),
      angle: angle.slice(0, 180),
      goal: goals[i % goals.length],
      pillar: theme.slice(0, 40),
      channel,
      format: FORMATS[i % FORMATS.length],
      publishTime: ['09:00', '11:00', '12:00', '14:00', '17:00'][i % 5],
      priority: i + 1,
    };
  });
};

module.exports = {
  extractBriefKeywords,
  extractPromptThemes,
  buildPlannedTopic,
  buildPlannedAngle,
  buildPlanNarrative,
  buildItemsFromPlanBrief,
  buildBriefDrivenItems,
  composeAutonomousPost,
  subjectFromTopic,
};
