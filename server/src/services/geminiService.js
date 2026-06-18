const axios = require('axios');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-flash-latest'];
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidKey = (key) => key && key.length >= 20 && !key.includes('...');

const parseRetryDelayMs = (message) => {
  const match = String(message || '').match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : null;
};

const formatError = (err) => {
  const status = err.response?.status;
  const msg = err.response?.data?.error?.message || err.message;
  const error = new Error(msg);
  error.status = status;
  return error;
};

const callGemini = async ({ prompt, model, temperature, key, imagePart = null, timeoutMs = 90000 }) => {
  const parts = [{ text: prompt }];
  if (imagePart) parts.push(imagePart);

  const { data } = await axios.post(
    `${BASE_URL}/models/${model}:generateContent?key=${key}`,
    {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
      },
    },
    { timeout: timeoutMs }
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
};

const imagePartFromPath = (imagePath) => {
  const fs = require('fs');
  const path = require('path');
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  return {
    inline_data: {
      mime_type: mime,
      data: buffer.toString('base64'),
    },
  };
};

const generateJSON = async ({ system, user, model = DEFAULT_MODEL, temperature = 0.8, imagePath = null, timeoutMs = 90000 }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!isValidKey(key)) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = system ? `${system}\n\n${user}` : user;
  const imagePart = imagePath ? imagePartFromPath(imagePath) : null;
  const models = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastErr;

  for (const tryModel of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await callGemini({ prompt, model: tryModel, temperature, key, imagePart, timeoutMs });
      } catch (err) {
        lastErr = formatError(err);
        const status = lastErr.status;
        const canRetry = RETRYABLE.has(status) && attempt < RETRY_DELAYS_MS.length;
        if (canRetry) {
          const delay = parseRetryDelayMs(lastErr.message) || RETRY_DELAYS_MS[attempt];
          await sleep(delay);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr || new Error('Gemini request failed');
};

/** Single model, no retries — for Vercel pipeline steps with tight timeouts. */
const generateJSONOnce = async ({
  system, user, model = DEFAULT_MODEL, temperature = 0.8, imagePath = null, timeoutMs = 14_000,
}) => {
  const key = process.env.GEMINI_API_KEY;
  if (!isValidKey(key)) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const prompt = system ? `${system}\n\n${user}` : user;
  const imagePart = imagePath ? imagePartFromPath(imagePath) : null;
  return callGemini({ prompt, model, temperature, key, imagePart, timeoutMs });
};

const generateText = async ({ system, user, model = DEFAULT_MODEL, temperature = 0.8 }) => {
  const result = await generateJSON({
    system: system ? `${system}\nRespond with JSON: { "text": "your response" }` : undefined,
    user,
    model,
    temperature,
  });
  return result.text || result.content || JSON.stringify(result);
};

module.exports = {
  generateJSON, generateJSONOnce, generateText, isValidKey, DEFAULT_MODEL, sleep, callGemini,
};
