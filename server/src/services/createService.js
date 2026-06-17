const { generateJSON } = require('./llmService');
const gemini = require('./geminiService');
const logger = require('../utils/logger');

const AI_TIMEOUT_MS = process.env.VERCEL ? 20000 : 30000;
const GEMINI_TIMEOUT_MS = process.env.VERCEL ? 15000 : 30000;

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  }),
]);

const PLATFORM_SPECS = {
  linkedin: { maxChars: 3000, style: 'professional, insightful, narrative-driven, no hard sells', hashtagCount: '3-5' },
  twitter: { maxChars: 280, style: 'punchy, conversational, witty, hook in first 10 words', hashtagCount: '1-3' },
  instagram: { maxChars: 2200, style: 'visual storytelling, emotional, community-focused, strong CTA', hashtagCount: '10-20' },
  facebook: { maxChars: 63206, style: 'conversational, community-oriented, question-driven engagement', hashtagCount: '2-5' },
  tiktok: { maxChars: 2200, style: 'Gen-Z friendly, trend-aware, casual, hook within first 3 seconds', hashtagCount: '5-10' },
  universal: { maxChars: 500, style: 'clear, engaging, adaptable', hashtagCount: '3-5' },
};

const buildPostPrompt = ({ brandProfile, platform, topic, tone, type }) => {
  const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.universal;
  return {
    system: `You are a world-class social media content creator specialising in ${platform}.

Brand Context:
- Brand: ${brandProfile?.name || 'Unknown Brand'}
- Industry: ${brandProfile?.industry || 'General'}
- Voice: ${tone || brandProfile?.voice || 'professional'}
- Target Audience: ${brandProfile?.audience || 'General audience'}
- Value Proposition: ${brandProfile?.valueProposition || ''}
- Key Products/Services: ${(brandProfile?.products || []).join(', ')}

Platform Rules for ${platform}:
- Max characters: ${spec.maxChars}
- Style: ${spec.style}
- Hashtags: ${spec.hashtagCount} hashtags

Return ONLY valid JSON with keys: content (string), hashtags (array of strings without #), emojis (array)`,
    user: `Create a ${type || 'social post'} about: ${topic}. Make it authentic to the brand voice and optimised for ${platform}.`,
  };
};

const normalizePostResult = (result) => {
  const content = (
    result?.content
    || result?.text
    || result?.body
    || result?.post
    || ''
  ).trim();

  const hashtags = Array.isArray(result?.hashtags)
    ? result.hashtags
    : Array.isArray(result?.tags)
      ? result.tags
      : [];

  const emojis = Array.isArray(result?.emojis) ? result.emojis : [];

  return { content, hashtags, emojis };
};

const callCreateAI = async ({ system, user, label }) => {
  if (gemini.isValidKey(process.env.GEMINI_API_KEY)) {
    logger.info(`${label}: using Gemini`);
    return withTimeout(
      gemini.generateJSON({ system, user, temperature: 0.8, timeoutMs: GEMINI_TIMEOUT_MS }),
      AI_TIMEOUT_MS,
      'Content generation timed out',
    );
  }

  logger.info(`${label}: using OpenAI`);
  return withTimeout(
    generateJSON({ system, user, label }),
    AI_TIMEOUT_MS,
    'Content generation timed out',
  );
};

const generatePost = async ({ brandProfile, platform, topic, tone, type }) => {
  const { system, user } = buildPostPrompt({ brandProfile, platform, topic, tone, type });
  const result = await callCreateAI({ system, user, label: 'Create' });
  const normalized = normalizePostResult(result);

  if (!normalized.content) {
    throw new Error('AI returned empty content — try again with a more specific topic');
  }

  return normalized;
};

const generateBlog = async ({ brandProfile, topic, tone, wordCount }) => {
  const system = `You are a content strategist writing for ${brandProfile?.name || 'a brand'} in the ${brandProfile?.industry || 'general'} space. Voice: ${tone || 'professional'}. Audience: ${brandProfile?.audience || 'general'}.`;
  const user = `Write a ${wordCount}-word SEO-optimised blog article about: ${topic}. Return JSON with: title, content (markdown), metaDescription, suggestedTags (array).`;

  return callCreateAI({ system, user, label: 'CreateBlog' });
};

module.exports = { generatePost, generateBlog };
