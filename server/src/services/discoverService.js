const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const logger = require('../utils/logger');

const isValidKey = (key, minLen = 20) =>
  key && key.length >= minLen && !key.includes('...') && !key.endsWith('...');

let openaiClient = null;
let anthropicClient = null;

const getOpenAI = () => {
  if (!openaiClient && isValidKey(process.env.OPENAI_API_KEY)) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const getAnthropic = () => {
  if (!anthropicClient && isValidKey(process.env.ANTHROPIC_API_KEY)) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
};

const expandHex = (h) => {
  if (!h) return null;
  h = h.trim().toLowerCase();
  if (!h.startsWith('#')) return null;
  if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  if (/^#[0-9a-f]{8}$/.test(h)) return h.slice(0, 7);
  return null;
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map(x => Math.min(255, parseInt(x, 10)).toString(16).padStart(2, '0')).join('')}`;

const parseColor = (value) => {
  if (!value) return null;
  const hex = expandHex(value);
  if (hex) return hex;
  const rgb = String(value).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return rgbToHex(rgb[1], rgb[2], rgb[3]);
  return null;
};

const isNeutral = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 248 && min > 248) return true;
  if (max < 25) return true;
  if (max - min < 12 && max > 200) return true;
  if (max - min < 20 && max < 80) return true;
  return false;
};

const extractColorsFromHtml = (html) => {
  const raw = [];

  const add = (value) => {
    const hex = parseColor(value);
    if (hex && !isNeutral(hex)) raw.push(hex);
  };

  const metaPatterns = [
    /meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/gi,
    /meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/gi,
    /meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/gi,
  ];
  metaPatterns.forEach(re => {
    let m;
    while ((m = re.exec(html))) add(m[1]);
  });

  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const cssText = styleBlocks.join('\n') + html;

  const varRe = /--[\w-]*(?:primary|brand|accent|secondary|main|theme|color)[\w-]*\s*:\s*([^;}\n]+)/gi;
  let vm;
  while ((vm = varRe.exec(cssText))) add(vm[1]);

  (cssText.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || []).forEach(add);
  (cssText.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/gi) || []).forEach(add);

  const counts = {};
  raw.forEach(c => { counts[c] = (counts[c] || 0) + 1; });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c]) => c);
};

const buildColorProfile = (extracted) => {
  const unique = [...new Set(extracted)];
  const palette = unique.length >= 2
    ? unique.slice(0, 6)
    : unique.length === 1
      ? [unique[0], unique[0], '#111827', '#F3F4F6', '#FFFFFF']
      : ['#2563EB', '#1E40AF', '#F59E0B', '#111827', '#FFFFFF'];

  const text = palette.find(c => {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }) || '#111827';

  return {
    primary: palette[0],
    secondary: palette[1] || palette[0],
    accent: palette[2] || palette[1] || palette[0],
    background: '#FFFFFF',
    text,
    palette: [...new Set([...palette, '#FFFFFF', text])].slice(0, 6),
  };
};

const mergeColorProfiles = (aiColors, scrapedColors) => {
  const aiPalette = (aiColors?.palette || []).map(c => parseColor(c)).filter(Boolean);
  const hasDistinctAi = aiPalette.length >= 2 && aiPalette.some(c => !isNeutral(c) && c !== '#FF6B9D' && c !== '#4DA8EE');

  if (hasDistinctAi) {
    return {
      primary: parseColor(aiColors.primary) || scrapedColors.primary,
      secondary: parseColor(aiColors.secondary) || scrapedColors.secondary,
      accent: parseColor(aiColors.accent) || scrapedColors.accent,
      background: parseColor(aiColors.background) || scrapedColors.background,
      text: parseColor(aiColors.text) || scrapedColors.text,
      palette: [...new Set(aiPalette)].slice(0, 6),
    };
  }
  return scrapedColors;
};

const extractPageData = (html, url) => {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);

  const hostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Your Brand'; }
  })();

  const brandName = (ogSite?.[1] || title.split(/[|\-–—]/)[0] || hostname).trim();
  const description = descMatch?.[1] || ogDesc?.[1] || '';
  const keywords = keywordsMatch?.[1]?.split(',').map(k => k.trim()).filter(Boolean).slice(0, 8) || [];
  const extractedColors = extractColorsFromHtml(html);
  const colorProfile = buildColorProfile(extractedColors);

  return {
    text, title, description, brandName, keywords, extractedColors, colorProfile,
  };
};

const buildProfileFromScrape = (url, page) => ({
  name: page.brandName || 'Your Brand',
  industry: page.keywords[0] || 'Technology',
  voice: 'professional',
  audience: 'Business professionals and decision-makers',
  valueProposition: page.description || `Solutions and services from ${page.brandName}`,
  products: page.keywords.slice(0, 4).length ? page.keywords.slice(0, 4) : ['Core product', 'Professional services'],
  keywords: page.keywords.length ? page.keywords : ['brand', 'marketing', 'growth'],
  competitors: [],
  marketingSummary: page.description || `${page.brandName} provides value through its online presence at ${url}.`,
  colors: page.colorProfile,
  fonts: { heading: 'Sans-serif', body: 'Sans-serif' },
  _source: 'scrape',
});

const callOpenAI = async (prompt) => {
  const openai = getOpenAI();
  if (!openai) throw new Error('OpenAI not configured');
  logger.info('Using OpenAI for brand analysis');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
  });
  return response.choices[0].message.content;
};

const callAnthropic = async (prompt) => {
  const anthropic = getAnthropic();
  if (!anthropic) throw new Error('Anthropic not configured');
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
};

const analyzeWithAI = async (prompt) => {
  const hasAnthropic = isValidKey(process.env.ANTHROPIC_API_KEY);
  const hasOpenAI = isValidKey(process.env.OPENAI_API_KEY);
  const errors = [];

  if (hasAnthropic) {
    try {
      return { text: await callAnthropic(prompt), source: 'anthropic' };
    } catch (err) {
      errors.push(`Anthropic: ${err.message?.slice(0, 80)}`);
      const authFailed = err.status === 401 || err.message?.includes('x-api-key');
      if (!authFailed || !hasOpenAI) logger.warn(`Anthropic failed: ${err.message}`);
    }
  }

  if (hasOpenAI) {
    try {
      return { text: await callOpenAI(prompt), source: 'openai' };
    } catch (err) {
      errors.push(`OpenAI: ${err.message?.slice(0, 80)}`);
      logger.warn(`OpenAI failed: ${err.message}`);
    }
  }

  const err = new Error(errors.join(' | ') || 'No valid AI API keys configured');
  err.aiUnavailable = true;
  throw err;
};

const friendlyAIError = (err) => {
  if (err.usedScrapeFallback) {
    return null;
  }
  const msg = err.message || '';
  if (msg.includes('x-api-key') || msg.includes('authentication_error')) {
    return 'Invalid Anthropic API key — check ANTHROPIC_API_KEY in server/.env (no truncated keys with ...)';
  }
  if (msg.includes('quota') || err.status === 429) {
    return 'OpenAI quota exceeded — add billing at platform.openai.com or fix your Anthropic key';
  }
  if (msg.includes('Incorrect API key') || msg.includes('invalid_api_key')) {
    return 'Invalid OpenAI API key — check OPENAI_API_KEY in server/.env';
  }
  if (msg.includes('No valid AI API key')) return msg;
  return `AI analysis failed: ${msg.slice(0, 200)}`;
};

const scrapeUrl = async (url) => {
  let html = '';
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuriBot/1.0)' },
      maxRedirects: 5,
    });
    html = data;
  } catch (err) {
    logger.warn(`Could not scrape ${url}: ${err.message}`);
  }
  return extractPageData(html, url);
};

const analyzeWebsite = async (url) => {
  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
  try {
    new URL(normalizedUrl);
  } catch {
    throw new Error('Invalid URL. Enter a valid website address like https://example.com');
  }

  logger.info(`Analyzing website: ${normalizedUrl}`);

  const page = await scrapeUrl(normalizedUrl);

  const prompt = `Analyze this website data and extract brand information. Return ONLY valid JSON.

Website URL: ${normalizedUrl}
Page Title: ${page.title}
Meta Description: ${page.description}
Page Text (excerpt): ${page.text.slice(0, 2000)}
Detected CSS colors from website: ${page.extractedColors.slice(0, 8).join(', ') || 'none detected'}

Return this exact JSON structure:
{
  "name": "brand name",
  "industry": "industry category",
  "voice": "professional|casual|witty|bold|authoritative|friendly",
  "audience": "target audience description",
  "valueProposition": "core value proposition in 1-2 sentences",
  "products": ["product/service 1", "product/service 2"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "competitors": ["likely competitor 1", "likely competitor 2"],
  "marketingSummary": "2-3 sentence marketing strategy summary",
  "colors": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "accent": "#hexcode",
    "background": "#hexcode",
    "text": "#hexcode",
    "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"]
  },
  "fonts": { "heading": "font name", "body": "font name" }
}`;

  try {
    const { text, source } = await analyzeWithAI(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const profile = jsonMatch ? JSON.parse(jsonMatch[0]) : buildProfileFromScrape(normalizedUrl, page);
    profile.colors = mergeColorProfiles(profile.colors, page.colorProfile);
    profile._source = source;
    return profile;
  } catch (err) {
    logger.info(`AI unavailable — using scrape-based brand profile (${err.message?.slice(0, 80)})`);
    const profile = buildProfileFromScrape(normalizedUrl, page);
    profile._aiNote = 'Profile built from website metadata. Add valid API keys for full AI analysis.';
    return profile;
  }
};

const roastWebsite = async (url) => {
  const page = await scrapeUrl(url.startsWith('http') ? url : `https://${url}`);

  if (isValidKey(process.env.OPENAI_API_KEY)) {
    try {
      const openai = getOpenAI();
      if (!openai) throw new Error('OpenAI not configured');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `You are a brutally honest but constructive marketing expert. Roast this website and return ONLY JSON:

URL: ${url}
Title: ${page.title}
Content: ${page.text.slice(0, 2000)}

Return exactly:
{
  "overallScore": 72,
  "conversionScore": 65,
  "brandingScore": 80,
  "marketingScore": 70,
  "seoScore": 68,
  "roastHeadline": "one punchy sentence summary",
  "websiteRoast": "2-3 sentence funny but insightful roast",
  "conversionRoast": "roast of conversion elements",
  "brandingRoast": "roast of branding",
  "marketingRoast": "roast of marketing copy",
  "topWins": ["thing they do well 1", "thing they do well 2"],
  "topFixes": ["fix 1", "fix 2", "fix 3"]
}`,
        }],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      logger.warn(`Roast AI failed: ${err.message}`);
    }
  }

  return {
    overallScore: 70,
    conversionScore: 65,
    brandingScore: 72,
    marketingScore: 68,
    seoScore: page.description ? 75 : 55,
    roastHeadline: `${page.brandName || 'This site'} has room to grow`,
    websiteRoast: page.description
      ? `The site describes itself as: "${page.description.slice(0, 120)}..." — solid start, but could punch harder.`
      : 'Missing a clear meta description — search engines and visitors are guessing what you do.',
    conversionRoast: 'Add stronger CTAs above the fold.',
    brandingRoast: page.title ? `Title "${page.title}" — make sure it matches your brand voice.` : 'Page title needs work.',
    marketingRoast: 'Content could be more benefit-driven.',
    topWins: ['Has a live web presence', page.description ? 'Meta description exists' : 'URL is accessible'],
    topFixes: ['Sharpen value proposition', 'Add social proof', 'Improve meta tags for SEO'],
    _source: 'scrape',
  };
};

module.exports = { analyzeWebsite, roastWebsite, friendlyAIError };
