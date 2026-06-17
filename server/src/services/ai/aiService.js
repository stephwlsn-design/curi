const OpenAI = require('openai');
const logger = require('../../utils/logger');

let openaiClient = null;
const getOpenAI = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!openaiClient && key && key.length >= 20 && !key.includes('...')) {
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
};

const requireOpenAI = () => {
  const client = getOpenAI();
  if (!client) throw new Error('OpenAI not configured');
  return client;
};

/**
 * Build the system prompt from a brand profile
 */
function buildBrandSystemPrompt(brandProfile) {
  if (!brandProfile) return 'You are a world-class marketing copywriter.';

  return `You are a world-class marketing copywriter for ${brandProfile.name || 'this brand'}.

BRAND CONTEXT:
- Brand: ${brandProfile.name}
- Description: ${brandProfile.description}
- Value Proposition: ${brandProfile.valueProposition}
- Target Audience: ${brandProfile.voice?.audience}
- Brand Voice: ${brandProfile.voice?.tone?.join(', ')}
- Style: ${brandProfile.voice?.style}
- Products/Services: ${brandProfile.products?.join(', ')}

Always write content that:
1. Matches the brand voice and tone exactly
2. Speaks directly to the target audience
3. Highlights the value proposition naturally
4. Uses terminology and phrasing consistent with the brand
5. Is ready to publish without editing`;
}

/**
 * Generate text content for any platform
 */
async function generateContent({ brandProfile, type, platform, topic, tone, additionalContext }) {
  const systemPrompt = buildBrandSystemPrompt(brandProfile);

  const platformGuides = {
    linkedin: 'LinkedIn (professional, 1300 chars max, 3-5 hashtags, line breaks for readability)',
    twitter: 'X/Twitter (punchy, 280 chars max, 2-3 hashtags, optional emoji)',
    instagram: 'Instagram (engaging caption, 2200 chars max, 10-20 hashtags, emojis welcome)',
    facebook: 'Facebook (conversational, 63,206 chars max, 1-2 hashtags, tell a story)',
    blog: 'Blog article (800-2000 words, H2/H3 structure, SEO-friendly, actionable)',
    email: 'Email (compelling subject line + preheader + body, CTA button text)',
    ad: 'Ad copy (headline ≤40 chars, primary text ≤125 chars, CTA ≤25 chars)',
    landing: 'Landing page copy (hero headline, subheadline, 3 benefits, CTA)',
  };

  const userPrompt = `Create ${type} content for ${platformGuides[platform] || platform}.

Topic: ${topic}
Tone: ${tone || 'professional'}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Respond ONLY with valid JSON in this exact format:
{
  "text": "main content here",
  "subject": "email subject (only for email type)",
  "preheader": "email preheader (only for email type)",
  "headline": "headline (only for ad/landing type)",
  "hashtags": ["hashtag1", "hashtag2"],
  "emojis": ["emoji suggestions"],
  "characterCount": 123,
  "hook": "first line hook",
  "cta": "call to action text"
}`;

  const start = Date.now();
  const openai = requireOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content);
  result.aiMeta = {
    model: 'gpt-4o',
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    generationTime: Date.now() - start,
    creditsUsed: 1,
  };

  return result;
}

/**
 * Generate multiple content variations
 */
async function generateContentVariations({ brandProfile, type, platform, topic, tone, count = 3 }) {
  const promises = Array.from({ length: count }, () =>
    generateContent({ brandProfile, type, platform, topic, tone })
  );
  return Promise.all(promises);
}

/**
 * Repurpose content into multiple formats
 */
async function repurposeContent({ brandProfile, sourceText, sourceType, targetFormats }) {
  const systemPrompt = buildBrandSystemPrompt(brandProfile);

  const userPrompt = `Repurpose the following ${sourceType} into multiple formats.

SOURCE CONTENT:
${sourceText}

Create content for these formats: ${targetFormats.join(', ')}

Respond ONLY with valid JSON:
{
  "formats": {
    "tweets": ["tweet1", "tweet2", ...10 tweets],
    "linkedin_posts": ["post1", "post2", "post3"],
    "video_script": "complete video script",
    "email": { "subject": "...", "body": "..." },
    "ad_concepts": [{ "headline": "...", "body": "...", "cta": "..." }]
  }
}`;

  const openai = requireOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate a full campaign package
 */
async function generateCampaign({ brandProfile, goal, timeline, budget }) {
  const systemPrompt = buildBrandSystemPrompt(brandProfile);

  const userPrompt = `Create a complete marketing campaign for the following goal:

CAMPAIGN GOAL: ${goal}
TIMELINE: ${timeline || '30 days'}
BUDGET: ${budget || 'not specified'}

Generate a comprehensive campaign package. Respond ONLY with valid JSON:
{
  "strategy": "campaign strategy overview (2-3 paragraphs)",
  "socialPosts": [
    { "platform": "linkedin", "text": "...", "hashtags": [], "scheduledDay": 1 },
    ... 20 total posts across platforms
  ],
  "emails": [
    { "subject": "...", "preheader": "...", "body": "...", "sendDay": 1, "type": "launch" },
    ... 3 emails
  ],
  "videoScripts": [
    { "title": "...", "type": "product_reel", "duration": "30s", "scenes": [...] }
  ],
  "adConcepts": [
    { "format": "square", "headline": "...", "body": "...", "cta": "...", "platform": "instagram" }
  ],
  "launchChecklist": ["task1", "task2", ...],
  "kpis": [{ "metric": "...", "target": "...", "timeline": "..." }]
}`;

  const openai = requireOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 6000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate email sequence
 */
async function generateEmailSequence({ brandProfile, sequenceType, productName, additionalContext }) {
  const systemPrompt = buildBrandSystemPrompt(brandProfile);

  const sequenceConfigs = {
    welcome: { count: 4, days: [0, 1, 3, 7] },
    launch: { count: 5, days: [0, 1, 3, 7, 14] },
    abandoned_cart: { count: 3, days: [1, 3, 7] },
    newsletter: { count: 1, days: [0] },
    promotional: { count: 3, days: [0, 2, 5] },
  };

  const config = sequenceConfigs[sequenceType] || sequenceConfigs.welcome;

  const userPrompt = `Create a ${sequenceType} email sequence of ${config.count} emails.
Product/Service: ${productName || brandProfile?.products?.[0] || 'the product'}
${additionalContext ? `Context: ${additionalContext}` : ''}
Send days: ${config.days.join(', ')}

Respond ONLY with valid JSON:
{
  "sequence": [
    {
      "sendDay": 0,
      "subject": "...",
      "preheader": "...",
      "body": "full HTML-ready email body",
      "ctaText": "...",
      "ctaUrl": "https://example.com",
      "goal": "email goal"
    }
  ]
}`;

  const openai = requireOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Website roast scoring
 */
async function roastWebsite({ url, extractedContent }) {
  const userPrompt = `Analyse this website and provide a detailed marketing roast.

URL: ${url}
CONTENT: ${JSON.stringify(extractedContent).slice(0, 3000)}

Respond ONLY with valid JSON:
{
  "overallScore": 72,
  "scores": {
    "website": { "score": 75, "grade": "C+", "summary": "...", "positives": ["..."], "negatives": ["..."] },
    "conversion": { "score": 60, "grade": "D+", "summary": "...", "positives": [], "negatives": [] },
    "branding": { "score": 80, "grade": "B", "summary": "...", "positives": [], "negatives": [] },
    "marketing": { "score": 65, "grade": "C", "summary": "...", "positives": [], "negatives": [] }
  },
  "roastComment": "funny but constructive overall roast (2-3 sentences)",
  "topRecommendations": ["actionable fix 1", "actionable fix 2", "actionable fix 3"],
  "shareableHeadline": "social-ready roast headline"
}`;

  const openai = requireOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a brutally honest but constructive marketing expert who writes viral website roasts. Be specific, data-driven, and funny.' },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = {
  generateContent,
  generateContentVariations,
  repurposeContent,
  generateCampaign,
  generateEmailSequence,
  roastWebsite,
  buildBrandSystemPrompt,
};
