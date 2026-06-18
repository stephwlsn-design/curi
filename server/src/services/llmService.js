const OpenAI = require('openai');
const gemini = require('./geminiService');
const logger = require('../utils/logger');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const useGemini = () => gemini.isValidKey(process.env.GEMINI_API_KEY);

const callOpenAI = async ({ system, user, temperature = 0.8, model = 'gpt-4o-mini', json = true }) => {
  if (!openai) throw new Error('OpenAI not configured');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const response = await openai.chat.completions.create({
    model,
    messages,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    temperature,
    ...(json ? {} : { max_tokens: 1500 }),
  });

  const text = response.choices[0].message.content;
  return json ? JSON.parse(text) : text;
};

const generateJSON = async ({
  system, user, temperature = 0.8, label = 'LLM', imagePath = null, timeoutMs, once = false,
}) => {
  const budget = timeoutMs ?? (process.env.VERCEL ? 22_000 : 90_000);
  if (useGemini()) {
    logger.info(`${label}: using Gemini${imagePath ? ' (with reference image)' : ''}${once ? ' (single attempt)' : ''}`);
    if (once) {
      return gemini.generateJSONOnce({
        system, user, temperature, imagePath, timeoutMs: budget,
      });
    }
    return gemini.generateJSON({ system, user, temperature, imagePath, timeoutMs: budget });
  }

  logger.info(`${label}: using OpenAI`);
  return callOpenAI({ system, user, temperature, json: true });
};

const generateText = async ({ system, user, temperature = 0.8, label = 'LLM' }) => {
  if (useGemini()) {
    logger.info(`${label}: using Gemini`);
    const result = await gemini.generateJSON({
      system: system ? `${system}\nReturn JSON: { "text": "your response" }` : 'Return JSON: { "text": "your response" }',
      user,
      temperature,
    });
    return result.text || result.content || result.strategy || '';
  }

  logger.info(`${label}: using OpenAI`);
  return callOpenAI({ system, user, temperature, json: false });
};

module.exports = { generateJSON, generateText };
