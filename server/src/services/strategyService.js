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

const derivePromptThemes = (contentPrompt, count) => {
  const direction = contentPrompt?.trim();
  if (!direction) return [];
  const parts = direction
    .split(/[.!?]\s+|\n+|;\s+|(?:\s+and\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);
  if (!parts.length) return [direction.slice(0, 100)];
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(parts[i % parts.length]);
  return out;
};

const buildFallbackItems = ({ topics, days, channels, entryCount, brandProfile, contentPrompt = '', designIdea = null }) => {
  const pool = topics.length ? topics : [{ topic: `${brandProfile?.name || 'Brand'} update` }];
  const pillars = ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'];
  const goals = ['awareness', 'education', 'engagement', 'conversion', 'trust'];
  const count = entryCount || days;
  const brand = brandProfile?.name || 'the brand';
  const audience = brandProfile?.audience || 'your audience';
  const direction = contentPrompt?.trim();
  const themes = derivePromptThemes(contentPrompt, count);
  const visualNote = designIdea?.analyzedDirection || designIdea?.notes || '';
  return Array.from({ length: count }, (_, i) => {
    const theme = themes[i] || direction;
    const baseTopic = pool[i % pool.length].topic;
    const topic = theme
      ? `${theme.slice(0, 80)}${baseTopic && !theme.toLowerCase().includes(baseTopic.toLowerCase().slice(0, 12)) ? ` · ${baseTopic}` : ''}`
      : baseTopic;
    const angle = theme
      ? `${theme} — ${pillars[i % pillars.length]} for ${audience}`
      : `${brand} take for ${audience} — ${pillars[i % pillars.length].toLowerCase()} focus`;
    return {
      day: spreadDay(i, count, days),
      topic: topic.slice(0, 140),
      angle: visualNote && i % 3 === 0
        ? `${angle} (visual: ${visualNote.slice(0, 80)})`
        : angle.slice(0, 180),
      goal: goals[i % goals.length],
      pillar: pillars[i % pillars.length],
      channel: channels[i % channels.length] || 'linkedin',
      format: FORMATS[i % FORMATS.length],
      publishTime: ['09:00', '11:00', '12:00', '14:00', '17:00'][i % 5],
      priority: i + 1,
    };
  });
};

const buildFallbackPlan = (brandProfile, days, entryCount, contentPrompt = '', designIdea = null, channels = []) => {
  const duration = getDurationPlan(days);
  const direction = contentPrompt?.trim();
  const visual = designIdea?.analyzedDirection || designIdea?.notes || '';
  const phases = duration.phases.map((p, i) => ({
    name: p.name,
    dayRange: p.name.match(/\d+–\d+|\d+-\d+/)?.[0] || '',
    focus: direction
      ? `${direction.split(/[.!?]/)[0]?.slice(0, 80) || direction.slice(0, 80)} — ${p.focus}`
      : p.focus,
  }));
  return {
    name: direction
      ? `${days}-Day Plan: ${direction.slice(0, 50)}${direction.length > 50 ? '…' : ''}`
      : `${days}-Day ${brandProfile?.name || 'Brand'} Content Plan`,
    campaignGoal: direction || `Build consistent ${days}-day visibility and engagement for ${brandProfile?.name || 'the brand'}`,
    narrative: [
      direction && `Campaign direction: ${direction}`,
      visual && `Visual direction: ${visual}`,
      `Phased ${days}-day arc across ${entryCount} touchpoints.`,
    ].filter(Boolean).join(' '),
    contentPillars: direction
      ? derivePromptThemes(contentPrompt, 5).slice(0, 5).map((t) => t.slice(0, 40))
      : ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'],
    phases,
    channelStrategy: direction
      ? `Execute "${direction.slice(0, 60)}" across ${channelsLabel(channels)} — ${entryCount} entries over ${days} days.`
      : `Rotate content across selected channels with one planned touchpoint per campaign day (${entryCount} entries across ${days} days).`,
    clusters: [],
  };
};

const channelsLabel = (channels = []) => (channels.length ? channels.join(', ') : 'selected channels');

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
  const hasCustomDirection = Boolean(contentPrompt?.trim() || designIdea?.notes || designIdea?.analyzedDirection || designIdea?.imageUrl);

  const fallbackStrategy = () => {
    const items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt, designIdea });
    const parsed = buildFallbackPlan(brandProfile, days, entryCount, contentPrompt, designIdea, channels);
    return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
  };

  if (process.env.VERCEL && !hasCustomDirection) {
    return fallbackStrategy();
  }

  if (process.env.VERCEL && hasCustomDirection) {
    try {
      const { system, user } = buildStrategyPrompt({
        brandProfile,
        onboarding,
        topics,
        days,
        channels,
        preferences,
        designIdea,
        maxEntries: entryCount,
        compact: true,
        contentPrompt,
      });
      const parsed = await generateJSON({
        label: 'Strategy',
        system,
        user,
        temperature: 0.72,
        timeoutMs: 20_000,
      });
      let items = (parsed.items || []).slice(0, entryCount);
      if (!items.length) return fallbackStrategy();
      items = items.map((item, i) => ({
        ...item,
        day: item.day && item.day <= days ? item.day : spreadDay(i, items.length, days),
        channel: normalizeChannel(item.channel || channels[i % channels.length]),
        format: normalizeFormat(item.format),
      }));
      return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
    } catch (err) {
      logger.warn(`Vercel strategy AI failed, using prompt-aware fallback: ${err.message?.slice(0, 100)}`);
      return fallbackStrategy();
    }
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
    const items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt, designIdea });
    return persistStrategy({
      workspaceId, userId, days, runId,
      parsed: buildFallbackPlan(brandProfile, days, entryCount, contentPrompt, designIdea, channels),
      items,
    });
  }

  let items = (parsed.items || []).slice(0, entryCount);
  if (!items.length) {
    items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt, designIdea });
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
