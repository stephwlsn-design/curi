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
  if (phrases.length) return [...new Set(phrases)].slice(0, 5);
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w)),
  )].slice(0, 5);
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
  const themeHint = keywords[entry.day % Math.max(keywords.length, 1)] || null;
  const kws = (brandProfile.keywords || []).slice(0, 4);
  const day = entry.day || 1;

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

module.exports = {
  extractBriefKeywords,
  buildPlannedTopic,
  buildPlannedAngle,
  buildPlanNarrative,
  composeAutonomousPost,
  subjectFromTopic,
};
