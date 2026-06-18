const Strategy = require('../models/Strategy');
const CalendarEntry = require('../models/CalendarEntry');
const { generateJSON } = require('./llmService');
const { buildStrategyPrompt, getDurationPlan } = require('../utils/strategyPrompt');
const logger = require('../utils/logger');

const FORMATS = ['post', 'carousel', 'story', 'video', 'reel'];

const normalizeFormat = (format) => {
  const t = String(format || 'post').toLowerCase();
  if (t.includes('carousel')) return 'carousel';
  if (t.includes('story')) return 'story';
  if (t.includes('reel')) return 'reel';
  if (t.includes('video')) return 'video';
  if (t.includes('ad')) return 'ad_creative';
  return 'post';
};

const normalizeChannel = (channel) => {
  const c = String(channel || 'linkedin').toLowerCase().replace(/[^a-z]/g, '');
  const map = { linkedin: 'linkedin', twitter: 'twitter', x: 'twitter', instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok' };
  return map[c] || 'linkedin';
};

const spreadDay = (index, total, days) => {
  if (total <= 1) return 1;
  return Math.max(1, Math.min(days, Math.round(((index + 1) / total) * days)));
};

const buildFallbackItems = ({ topics, days, channels, entryCount, brandProfile, contentPrompt = '' }) => {
  const pool = topics.length ? topics : [{ topic: `${brandProfile?.name || 'Brand'} update` }];
  const pillars = ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'];
  const goals = ['awareness', 'education', 'engagement', 'conversion', 'trust'];
  const count = entryCount || days;
  const brand = brandProfile?.name || 'the brand';
  const audience = brandProfile?.audience || 'your audience';
  const direction = contentPrompt?.trim();
  return Array.from({ length: count }, (_, i) => ({
    day: spreadDay(i, count, days),
    topic: direction && i === 0
      ? `${pool[i % pool.length].topic} — ${direction.slice(0, 60)}`
      : pool[i % pool.length].topic,
    angle: direction
      ? `${direction.slice(0, 100)} (${pillars[i % pillars.length]} for ${audience})`
      : `${brand} take for ${audience} — ${pillars[i % pillars.length].toLowerCase()} focus`,
    goal: goals[i % goals.length],
    pillar: pillars[i % pillars.length],
    channel: channels[i % channels.length] || 'linkedin',
    format: FORMATS[i % FORMATS.length],
    publishTime: ['09:00', '11:00', '12:00', '14:00', '17:00'][i % 5],
    priority: i + 1,
  }));
};

const buildFallbackPlan = (brandProfile, days, entryCount, contentPrompt = '') => {
  const duration = getDurationPlan(days);
  const direction = contentPrompt?.trim();
  return {
    name: `${days}-Day ${brandProfile?.name || 'Brand'} Content Plan`,
    campaignGoal: direction || `Build consistent ${days}-day visibility and engagement for ${brandProfile?.name || 'the brand'}`,
    narrative: direction
      ? `User direction: ${direction}. Phased arc across ${days} days.`
      : `A phased ${days}-day arc: ${duration.phases.map((p) => p.focus).slice(0, 2).join('; ')}.`,
    contentPillars: ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'],
    phases: duration.phases.map((p) => ({ name: p.name, dayRange: p.name.match(/\d+–\d+|\d+-\d+/)?.[0] || '', focus: p.focus })),
    channelStrategy: `Rotate content across selected channels with one planned touchpoint per campaign day (${entryCount} entries across ${days} days).`,
    clusters: [],
  };
};

const extractPlanBrief = (parsed, days) => ({
  campaignGoal: parsed.campaignGoal || `Build consistent ${days}-day brand presence`,
  narrative: parsed.narrative || '',
  contentPillars: parsed.contentPillars || [],
  phases: parsed.phases || [],
  channelStrategy: parsed.channelStrategy || '',
});

const persistStrategy = async ({
  workspaceId, userId, days, runId, parsed, items,
}) => {
  const strategy = await Strategy.create({
    workspace: workspaceId,
    createdBy: userId,
    name: parsed.name || `${days}-Day Content Strategy`,
    days,
    items: items.map((item) => ({
      topic: item.topic,
      channel: normalizeChannel(item.channel),
      format: normalizeFormat(item.format),
      day: item.day,
      publishTime: item.publishTime || '09:00',
      priority: item.priority || 1,
      angle: item.angle,
      goal: item.goal,
      pillar: item.pillar,
    })),
    clusters: parsed.clusters || [],
    planBrief: extractPlanBrief(parsed, days),
    status: 'active',
    autonomousRun: runId,
  });

  const entries = await CalendarEntry.insertMany(
    strategy.items.map((item) => {
      const planningNote = [item.topic, item.angle].filter(Boolean).join(' — ');
      return {
        workspace: workspaceId,
        day: item.day,
        platform: normalizeChannel(item.channel),
        type: normalizeFormat(item.format),
        topic: item.topic,
        caption: planningNote,
        publishTime: item.publishTime || '09:00',
        strategy: strategy._id,
        autonomousRun: runId,
        status: 'planned',
      };
    }),
  );

  return { strategy, entries };
};

const generateStrategy = async ({
  workspaceId,
  userId,
  brandProfile,
  onboarding = null,
  topics,
  days = 30,
  channels = ['linkedin', 'instagram'],
  preferences = null,
  designIdea = null,
  runId = null,
  maxEntries = null,
  contentPrompt = '',
}) => {
  const entryCount = maxEntries || Math.min(days, 30);

  if (process.env.VERCEL) {
    const items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt });
    const parsed = buildFallbackPlan(brandProfile, days, entryCount, contentPrompt);
    return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
  }

  const { system, user } = buildStrategyPrompt({
    brandProfile,
    onboarding,
    topics,
    days,
    channels,
    preferences,
    designIdea,
    maxEntries: entryCount,
    compact: Boolean(process.env.VERCEL),
    contentPrompt,
  });

  let parsed;
  try {
    parsed = await generateJSON({
      label: 'Strategy',
      system,
      user,
      temperature: 0.72,
      timeoutMs: process.env.VERCEL ? 15_000 : 55_000,
    });
  } catch (err) {
    logger.warn(`Strategy AI failed, using topic-based fallback: ${err.message?.slice(0, 100)}`);
    const items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt });
    return persistStrategy({
      workspaceId, userId, days, runId,
      parsed: buildFallbackPlan(brandProfile, days, entryCount, contentPrompt),
      items,
    });
  }

  let items = (parsed.items || []).slice(0, entryCount);
  if (!items.length) {
    items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt });
  }

  // Ensure days are spread across the campaign window
  items = items.map((item, i) => ({
    ...item,
    day: item.day && item.day <= days ? item.day : spreadDay(i, items.length, days),
    channel: normalizeChannel(item.channel || channels[i % channels.length]),
    format: normalizeFormat(item.format),
  }));

  return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
};

module.exports = { generateStrategy, FORMATS, normalizeFormat, normalizeChannel };
