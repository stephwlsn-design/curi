const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const logger = require('../../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Scrape a website using Browserless or direct Cheerio fallback
 */
async function scrapeWebsite(url) {
  try {
    // Try Browserless first (handles JS-rendered sites)
    if (process.env.BROWSERLESS_TOKEN) {
      const response = await axios.post(
        `https://chrome.browserless.io/content?token=${process.env.BROWSERLESS_TOKEN}`,
        { url, waitFor: 2000 },
        { timeout: 15000 }
      );
      return response.data;
    }

    // Fallback: direct fetch
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuriBot/1.0)' },
    });
    return response.data;
  } catch (err) {
    logger.error('Scrape error:', err.message);
    throw new Error(`Failed to access website: ${err.message}`);
  }
}

/**
 * Extract brand data from HTML
 */
function extractFromHtml(html, url) {
  const $ = cheerio.load(html);

  // Extract all text content
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

  // Meta data
  const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const siteName = $('meta[property="og:site_name"]').attr('content') || '';

  // Extract headings for product/service names
  const headings = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 3 && text.length < 100) headings.push(text);
  });

  // Extract colors from inline styles and CSS
  const colors = new Set();
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const matches = style.match(/#[0-9a-fA-F]{3,6}/g) || [];
    matches.forEach((c) => colors.add(c.toUpperCase()));
  });

  // Extract fonts from style tags
  const fonts = new Set();
  $('style').each((_, el) => {
    const css = $(el).text();
    const fontMatches = css.match(/font-family:\s*([^;,}]+)/gi) || [];
    fontMatches.forEach((f) => {
      const fontName = f.replace(/font-family:\s*/i, '').replace(/['"]/g, '').trim().split(',')[0];
      if (fontName && fontName.length < 50) fonts.add(fontName);
    });
  });

  // Extract logo
  let logoUrl = '';
  const logoSelectors = ['img[alt*="logo" i]', 'img[src*="logo" i]', 'header img', '.logo img', '#logo img'];
  for (const sel of logoSelectors) {
    const src = $(sel).first().attr('src');
    if (src) {
      logoUrl = src.startsWith('http') ? src : new URL(src, url).href;
      break;
    }
  }

  // Extract CTAs
  const ctas = [];
  $('a.btn, a.button, button, .cta, [class*="cta"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 1 && text.length < 50) ctas.push(text);
  });

  // Extract nav items (often product/service names)
  const navItems = [];
  $('nav a, header a').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 1 && text.length < 30) navItems.push(text);
  });

  return {
    url,
    title,
    siteName: siteName || title,
    description,
    ogImage,
    bodyText,
    headings: headings.slice(0, 20),
    colors: Array.from(colors).slice(0, 10),
    fonts: Array.from(fonts).slice(0, 5),
    logoUrl,
    ctas: [...new Set(ctas)].slice(0, 10),
    navItems: [...new Set(navItems)].slice(0, 15),
  };
}

/**
 * Use AI to analyse extracted content and build brand profile
 */
async function analyseWithAI(extracted) {
  const prompt = `Analyse this website data and create a comprehensive brand profile.

WEBSITE DATA:
URL: ${extracted.url}
Title: ${extracted.title}
Description: ${extracted.description}
Headlines: ${extracted.headings.slice(0, 10).join(' | ')}
Navigation: ${extracted.navItems.join(', ')}
CTAs: ${extracted.ctas.join(', ')}
Body content excerpt: ${extracted.bodyText.slice(0, 2000)}

Respond ONLY with valid JSON:
{
  "name": "Brand Name",
  "tagline": "Brand tagline or value prop in one line",
  "description": "2-3 sentence brand description",
  "products": ["product1", "product2", "service1"],
  "valueProposition": "core value proposition (1-2 sentences)",
  "marketingSummary": "3-paragraph marketing strategy summary",
  "voice": {
    "tone": ["professional", "friendly", "innovative"],
    "style": "conversational",
    "audience": "target audience description",
    "persona": "brand personality archetype"
  },
  "industry": "primary industry",
  "competitors": [
    { "name": "Competitor 1", "url": "https://...", "summary": "brief positioning" }
  ],
  "contentOpportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "keyMessages": ["message1", "message2", "message3"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a senior brand strategist and marketing expert. Analyse websites and extract actionable brand intelligence.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Main discover function — entry point
 */
async function discoverBrand(url) {
  logger.info(`Discovering brand: ${url}`);

  // 1. Scrape
  const html = await scrapeWebsite(url);

  // 2. Extract structured data from HTML
  const extracted = extractFromHtml(html, url);

  // 3. AI analysis
  const aiAnalysis = await analyseWithAI(extracted);

  // 4. Merge results into brand profile
  const brandProfile = {
    url,
    name: aiAnalysis.name || extracted.siteName,
    tagline: aiAnalysis.tagline,
    description: aiAnalysis.description,
    products: aiAnalysis.products || [],
    valueProposition: aiAnalysis.valueProposition,
    marketingSummary: aiAnalysis.marketingSummary,
    voice: aiAnalysis.voice,
    industry: aiAnalysis.industry,
    competitors: aiAnalysis.competitors || [],
    contentOpportunities: aiAnalysis.contentOpportunities || [],
    keyMessages: aiAnalysis.keyMessages || [],
    visuals: {
      colors: extracted.colors.length ? extracted.colors : ['#1A1A2E', '#E91E8C', '#1E90FF'],
      fonts: extracted.fonts.length ? extracted.fonts : ['Inter', 'Sans-serif'],
      logoUrl: extracted.logoUrl,
      ogImage: extracted.ogImage,
    },
    extractedAt: new Date(),
  };

  return brandProfile;
}

module.exports = { discoverBrand, scrapeWebsite, extractFromHtml };
