const Topic = require('../models/Topic');
const logger = require('../utils/logger');
const { generateJSON } = require('./llmService');

const brandCtx = (bp) => `
Brand: ${bp?.name || 'Brand'}
Industry: ${bp?.industry || 'General'}
Audience: ${bp?.audience || 'General'}
Competitors: ${(bp?.competitors || []).join(', ')}
Keywords: ${(bp?.keywords || []).join(', ')}
`;

const discoverTopics = async ({ workspaceId, brandProfile }) => {
  const parsed = await generateJSON({
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
  });

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

  logger.info(`Topic discovery: ${saved.length} topics for workspace ${workspaceId}`);
  return saved;
};

module.exports = { discoverTopics };
