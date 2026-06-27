const { generateJSON } = require('./llmService');
const logger = require('../utils/logger');
const { buildFallbackTrends, buildFallbackCompetitorAnalysis } = require('../utils/growthFallbacks');

const brandCtx = (bp) => `
Brand: ${bp?.name || 'Brand'}
Industry: ${bp?.industry || 'General'}
Voice: ${bp?.voice || 'professional'}
Audience: ${bp?.audience || 'General'}
Products: ${(bp?.products || []).join(', ')}
`;

const generateCalendar = async ({ brandProfile, days = 30, goal }) => {
  return generateJSON({
    label: 'Calendar',
    system: 'Return ONLY valid JSON.',
    user: `${brandCtx(brandProfile)}
Generate a ${days}-day content calendar. Goal: ${goal || 'consistent brand presence'}.
Return JSON: { "entries": [{ "day": 1, "date": "Day 1", "platform": "linkedin", "type": "post", "topic": "...", "caption": "...", "publishTime": "09:00" }] }`,
  });
};

const repurposeContent = async ({ brandProfile, sourceContent, sourceType = 'blog' }) => {
  return generateJSON({
    label: 'Repurpose',
    system: 'Return ONLY valid JSON.',
    user: `${brandCtx(brandProfile)}
Repurpose this ${sourceType} into 10 formats:
Source: ${sourceContent}
Return JSON: { "formats": [{ "type": "tweet|linkedin|instagram|email|video_script|ad|newsletter|thread|carousel|podcast", "title": "...", "content": "..." }] }`,
  });
};

const scanTrends = async ({ brandProfile, industry }) => {
  const resolvedIndustry = industry || brandProfile?.industry || 'General';
  try {
    const result = await generateJSON({
      label: 'Trends',
      system: 'Return ONLY valid JSON.',
      user: `${brandCtx(brandProfile)}
Scan trending topics for ${resolvedIndustry} relevant to this brand.
Return JSON: { "trends": [{ "topic": "...", "platform": "linkedin|twitter|reddit", "relevance": 90, "contentIdea": "...", "hashtags": [] }] }`,
      timeoutMs: process.env.VERCEL ? 12_000 : 15_000,
    });
    const trends = Array.isArray(result?.trends) ? result.trends.filter((t) => t?.topic) : [];
    if (trends.length) return { trends, industry: resolvedIndustry, source: 'ai' };
  } catch (err) {
    logger.warn(`[trends] AI scan failed: ${err.message}`);
  }
  return {
    trends: buildFallbackTrends(brandProfile, resolvedIndustry),
    industry: resolvedIndustry,
    source: 'fallback',
  };
};

const analyzeCompetitor = async ({ brandProfile, competitorUrl, competitorName, competitorIntel }) => {
  const target = competitorName || competitorUrl || 'Category leader';
  const intelBlock = competitorIntel
    ? `\nScraped competitor intel:\n${JSON.stringify(competitorIntel, null, 2)}`
    : '';
  try {
    const result = await generateJSON({
      label: 'Competitor',
      system: 'Return ONLY valid JSON.',
      user: `${brandCtx(brandProfile)}
Analyze competitor: ${target}${intelBlock}
Return JSON: { "competitor": "name", "strengths": [], "weaknesses": [], "contentStrategy": "...", "recommendations": [{ "action": "...", "impact": "high|medium|low", "priority": 1 }], "score": 72 }`,
      timeoutMs: process.env.VERCEL ? 12_000 : 15_000,
    });
    if (result?.competitor || result?.strengths?.length) {
      return { ...result, source: 'ai' };
    }
  } catch (err) {
    logger.warn(`[competitor] AI analysis failed: ${err.message}`);
  }
  return {
    ...buildFallbackCompetitorAnalysis(brandProfile, target),
    source: 'fallback',
  };
};

module.exports = { generateCalendar, repurposeContent, scanTrends, analyzeCompetitor };
