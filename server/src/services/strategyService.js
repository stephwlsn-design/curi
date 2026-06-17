const Strategy = require('../models/Strategy');
const CalendarEntry = require('../models/CalendarEntry');
const { generateJSON } = require('./llmService');
const { buildStrategyPrompt } = require('../utils/strategyPrompt');
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

const buildFallbackItems = ({ topics, days, channels, entryCount, brandProfile }) => {
  const pool = topics.length ? topics : [{ topic: `${brandProfile?.name || 'Brand'} update` }];
  const pillars = ['Education', 'Social proof', 'Product value', 'Thought leadership'];
  return Array.from({ length: entryCount }, (_, i) => ({
    day: spreadDay(i, entryCount, days),
    topic: pool[i % pool.length].topic,
    angle: `Tailored for ${brandProfile?.audience || 'your audience'}`,
    goal: ['awareness', 'education', 'engagement', 'conversion'][i % 4],
    pillar: pillars[i % pillars.length],
    channel: channels[i % channels.length] || 'linkedin',
    format: FORMATS[i % FORMATS.length],
    publishTime: '09:00',
    priority: i + 1,
  }));
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

  const entries = [];
  for (const item of strategy.items) {
    const planningNote = [item.topic, item.angle].filter(Boolean).join(' — ');
    const entry = await CalendarEntry.create({
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
    });
    entries.push(entry);
  }

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
}) => {
  const entryCount = maxEntries || Math.min(days, 30);
  const { system, user } = buildStrategyPrompt({
    brandProfile,
    onboarding,
    topics,
    days,
    channels,
    preferences,
    designIdea,
    maxEntries: entryCount,
  });

  let parsed;
  try {
    parsed = await generateJSON({
      label: 'Strategy',
      system,
      user,
      temperature: 0.72,
      timeoutMs: process.env.VERCEL ? 22_000 : 55_000,
    });
  } catch (err) {
    logger.warn(`Strategy AI failed, using topic-based fallback: ${err.message?.slice(0, 100)}`);
    const items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile });
    return persistStrategy({
      workspaceId, userId, days, runId,
      parsed: {
        name: `${days}-Day ${brandProfile?.name || 'Brand'} Plan`,
        campaignGoal: `Sustain ${days}-day visibility for ${brandProfile?.name || 'the brand'}`,
        narrative: `A phased content arc across ${days} days using discovered brand topics.`,
        contentPillars: ['Education', 'Engagement', 'Conversion'],
        clusters: [],
      },
      items,
    });
  }

  let items = (parsed.items || []).slice(0, entryCount);
  if (!items.length) {
    items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile });
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
