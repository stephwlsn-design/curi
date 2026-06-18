const Strategy = require('../models/Strategy');
const CalendarEntry = require('../models/CalendarEntry');
const { generateJSON } = require('./llmService');
const gemini = require('./geminiService');
const { buildStrategyPrompt, buildPlanBriefOnlyPrompt, getDurationPlan } = require('../utils/strategyPrompt');
const {
  extractBriefKeywords,
  buildPlannedTopic,
  buildPlannedAngle,
  buildPlanNarrative,
  buildItemsFromPlanBrief,
} = require('../utils/campaignContent');
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

const buildFallbackItems = ({ topics, days, channels, entryCount, brandProfile, contentPrompt = '', designIdea = null }) => {
  const pool = topics.length ? topics : [{ topic: `${brandProfile?.name || 'Brand'} update` }];
  const pillars = ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'];
  const goals = ['awareness', 'education', 'engagement', 'conversion', 'trust'];
  const count = entryCount || days;
  const briefKeywords = extractBriefKeywords(contentPrompt);
  const visualNote = designIdea?.analyzedDirection || designIdea?.notes || '';
  return Array.from({ length: count }, (_, i) => {
    const poolTopic = pool[i % pool.length];
    const pillar = pillars[i % pillars.length];
    const goal = goals[i % goals.length];
    const channel = channels[i % channels.length] || 'linkedin';
    const day = spreadDay(i, count, days);
    const topic = buildPlannedTopic({
      brandProfile,
      poolTopic,
      pillar,
    });
    let angle = buildPlannedAngle({
      pillar,
      goal,
      audience: brandProfile?.audience || 'your audience',
      platform: channel,
      poolTopic,
      briefKeywords,
      index: i,
    });
    if (visualNote && i % 4 === 0) {
      angle = `${angle} · match reference aesthetic`.slice(0, 180);
    }
    return {
      day,
      topic,
      angle,
      goal,
      pillar,
      channel,
      format: FORMATS[i % FORMATS.length],
      publishTime: ['09:00', '11:00', '12:00', '14:00', '17:00'][i % 5],
      priority: i + 1,
    };
  });
};

const buildFallbackPlan = (brandProfile, days, entryCount, contentPrompt = '', designIdea = null, channels = []) => {
  const duration = getDurationPlan(days);
  const brief = contentPrompt?.trim();
  const kws = extractBriefKeywords(brief);
  const visual = designIdea?.analyzedDirection || designIdea?.notes || '';
  const phases = duration.phases.map((p) => ({
    name: p.name,
    dayRange: p.name.match(/\d+–\d+|\d+-\d+/)?.[0] || '',
    focus: kws.length ? `${p.focus} · aligned with ${kws[0]}` : p.focus,
  }));
  return {
    name: kws.length
      ? `${days}-Day ${brandProfile?.name || 'Brand'} Campaign`
      : `${days}-Day ${brandProfile?.name || 'Brand'} Content Plan`,
    campaignGoal: brief
      ? `Build a ${days}-day presence for ${brandProfile?.name || 'the brand'} around: ${kws.slice(0, 3).join(', ') || 'core themes'}`
      : `Build consistent ${days}-day visibility and engagement for ${brandProfile?.name || 'the brand'}`,
    narrative: buildPlanNarrative({
      brandProfile,
      days,
      entryCount,
      brief,
      visual,
      channels,
    }),
    contentPillars: kws.length
      ? kws.slice(0, 5).map((k) => k.slice(0, 40))
      : ['Education', 'Social proof', 'Product value', 'Thought leadership', 'Community'],
    phases,
    channelStrategy: `Rotate ${entryCount} posts across ${channelsLabel(channels)} over ${days} days — each post is unique, informed by brand topics${kws.length ? ` and campaign themes (${kws.slice(0, 2).join(', ')})` : ''}.`,
    clusters: [],
  };
};

const channelsLabel = (channels = []) => (channels.length ? channels.join(', ') : 'selected channels');

const extractPlanBrief = (parsed, days, contentPrompt = '') => ({
  campaignGoal: parsed.campaignGoal || `Build consistent ${days}-day brand presence`,
  narrative: parsed.narrative || '',
  contentPillars: parsed.contentPillars || [],
  phases: parsed.phases || [],
  channelStrategy: parsed.channelStrategy || '',
  userBrief: contentPrompt?.trim() || parsed.userBrief || '',
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
    planBrief: extractPlanBrief(parsed, days, parsed.userBrief),
    status: 'active',
    autonomousRun: runId,
  });

  const entries = await CalendarEntry.insertMany(
    strategy.items.map((item) => ({
      workspace: workspaceId,
      day: item.day,
      platform: normalizeChannel(item.channel),
      type: normalizeFormat(item.format),
      topic: item.topic,
      caption: item.angle || item.topic,
      publishTime: item.publishTime || '09:00',
      strategy: strategy._id,
      autonomousRun: runId,
      status: 'planned',
    })),
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

  const fallbackStrategy = () => {
    const items = buildFallbackItems({ topics, days, channels, entryCount, brandProfile, contentPrompt, designIdea });
    const parsed = buildFallbackPlan(brandProfile, days, entryCount, contentPrompt, designIdea, channels);
    parsed.userBrief = contentPrompt?.trim() || '';
    return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
  };

  const hasBrief = Boolean(contentPrompt?.trim() || designIdea?.notes || designIdea?.analyzedDirection);
  const canUseAiBrief = gemini.isValidKey(process.env.GEMINI_API_KEY);

  // Vercel: fast AI plan-brief (no 30-item JSON) then deterministic calendar build.
  if (process.env.VERCEL) {
    if (hasBrief && canUseAiBrief) {
      const { system, user } = buildPlanBriefOnlyPrompt({
        brandProfile,
        onboarding,
        topics,
        days,
        channels,
        designIdea,
        contentPrompt,
      });
      try {
        const parsed = await generateJSON({
          label: 'Strategy plan brief',
          system,
          user,
          temperature: 0.72,
          once: true,
          timeoutMs: 20_000,
        });
        parsed.userBrief = contentPrompt?.trim() || '';
        const items = buildItemsFromPlanBrief({
          planBrief: parsed,
          topics,
          days,
          channels,
          entryCount,
          brandProfile,
        });
        logger.info(`Strategy: AI plan brief OK — ${items.length} items from ${parsed.themeTopics?.length || 0} themes`);
        return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
      } catch (err) {
        logger.warn(`Strategy AI plan brief failed on Vercel, using fallback: ${err.message?.slice(0, 100)}`);
      }
    }
    return fallbackStrategy();
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
    const fallbackParsed = buildFallbackPlan(brandProfile, days, entryCount, contentPrompt, designIdea, channels);
    fallbackParsed.userBrief = contentPrompt?.trim() || '';
    return persistStrategy({
      workspaceId, userId, days, runId,
      parsed: fallbackParsed,
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

  parsed.userBrief = contentPrompt?.trim() || '';
  return persistStrategy({ workspaceId, userId, days, runId, parsed, items });
};

module.exports = { generateStrategy, FORMATS, normalizeFormat, normalizeChannel };
