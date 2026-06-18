const Topic = require('../models/Topic');
const logger = require('../utils/logger');
const { generateJSON } = require('./llmService');

const { buildBrandBrief } = require('../utils/strategyPrompt');

const brandCtx = (bp) => buildBrandBrief(bp, {}, Boolean(process.env.VERCEL));

const fallbackTopicsFromBrand = async (workspaceId, brandProfile) => {
  const seeds = [
    ...(brandProfile?.keywords || []),
    brandProfile?.industry && `${brandProfile.industry} trends`,
    brandProfile?.name && `${brandProfile.name} insights`,
    brandProfile?.valueProposition?.slice(0, 60),
    'Industry news roundup',
    'Customer success story',
    'Product tips and tricks',
    'Behind the brand',
  ].filter(Boolean).map((s) => String(s).trim()).filter((s) => s.length > 3);

  const unique = [...new Set(seeds)].slice(0, 8);
  const saved = [];
  for (let i = 0; i < unique.length; i += 1) {
    saved.push(await Topic.create({
      workspace: workspaceId,
      topic: unique[i],
      source: 'fallback',
      relevance: 90 - i * 3,
    }));
  }
  logger.info(`Topic discovery fallback: ${saved.length} topics for workspace ${workspaceId}`);
  return saved;
};

const discoverTopics = async ({ workspaceId, brandProfile }) => {
  let parsed;
  try {
    parsed = await generateJSON({
      label: 'TopicDiscovery',
      system: 'You are a content strategist. Return ONLY valid JSON.',
      user: `${brandCtx(brandProfile)}
Run topic discovery across trends, competitor content, and content gaps.

Return JSON:
{
  "trending": [{ "topic": "...", "volume": 95, "competition": 65, "growth": 40, "relevance": 88 }],
  "competitor": [{ "topic": "...", "competitor": "name", "engagement": 1200, "format": "carousel", "relevance": 75 }],
  "gaps": [{ "topic": "...", "reason": "competitors rank but brand does not cover", "relevance": 90 }]
}`,
      temperature: 0.7,
      timeoutMs: process.env.VERCEL ? 22_000 : 45_000,
    });
  } catch (err) {
    logger.warn(`Topic discovery AI failed, using brand fallback: ${err.message?.slice(0, 100)}`);
    return fallbackTopicsFromBrand(workspaceId, brandProfile);
  }

  const saved = [];

  for (const t of parsed.trending || []) {
    saved.push(await Topic.create({
      workspace: workspaceId, topic: t.topic, source: 'trend',
      volume: t.volume, competition: t.competition, growth: t.growth, relevance: t.relevance,
    }));
  }
  for (const t of parsed.competitor || []) {
    saved.push(await Topic.create({
      workspace: workspaceId, topic: t.topic, source: 'competitor',
      competitor: t.competitor, engagement: t.engagement, format: t.format, relevance: t.relevance,
    }));
  }
  for (const t of parsed.gaps || []) {
    saved.push(await Topic.create({
      workspace: workspaceId, topic: t.topic, source: 'gap',
      relevance: t.relevance, metadata: { reason: t.reason },
    }));
  }

  if (!saved.length) {
    return fallbackTopicsFromBrand(workspaceId, brandProfile);
  }

  logger.info(`Topic discovery: ${saved.length} topics for workspace ${workspaceId}`);
  return saved;
};

module.exports = { discoverTopics, fallbackTopicsFromBrand };
