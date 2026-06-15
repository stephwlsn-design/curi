const { generateJSON } = require('./llmService');

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
  return generateJSON({
    label: 'Trends',
    system: 'Return ONLY valid JSON.',
    user: `${brandCtx(brandProfile)}
Scan trending topics for ${industry || brandProfile?.industry || 'this industry'} relevant to this brand.
Return JSON: { "trends": [{ "topic": "...", "platform": "linkedin|twitter|reddit", "relevance": 90, "contentIdea": "...", "hashtags": [] }] }`,
  });
};

const analyzeCompetitor = async ({ brandProfile, competitorUrl, competitorName }) => {
  return generateJSON({
    label: 'Competitor',
    system: 'Return ONLY valid JSON.',
    user: `${brandCtx(brandProfile)}
Analyze competitor: ${competitorName || competitorUrl}
Return JSON: { "competitor": "name", "strengths": [], "weaknesses": [], "contentStrategy": "...", "recommendations": [{ "action": "...", "impact": "high|medium|low", "priority": 1 }], "score": 72 }`,
  });
};

module.exports = { generateCalendar, repurposeContent, scanTrends, analyzeCompetitor };
