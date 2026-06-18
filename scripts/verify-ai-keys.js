#!/usr/bin/env node
/**
 * Quick health check for Gemini (and optional OpenAI) API keys.
 * Loads server/.env when present.
 *
 * Usage:
 *   node scripts/verify-ai-keys.js
 *   GEMINI_API_KEY=... node scripts/verify-ai-keys.js
 */

const path = require('path');
const fs = require('fs');

module.paths.unshift(
  path.join(__dirname, '..', 'server', 'node_modules'),
  path.join(__dirname, '..', 'api', 'node_modules'),
);

const envPath = path.join(__dirname, '..', 'server', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const gemini = require('../server/src/services/geminiService');
const { buildPlanBriefOnlyPrompt } = require('../server/src/utils/strategyPrompt');

const maskKey = (key) => {
  if (!key) return '(not set)';
  if (key.length < 12) return '(too short)';
  return `${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)`;
};

const timed = async (label, fn) => {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`✓ ${label} (${ms}ms)`);
    return { ok: true, ms, result };
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`✗ ${label} (${ms}ms): ${err.message}`);
    return { ok: false, ms, error: err.message };
  }
};

const main = async () => {
  console.log('AI key verification\n');
  console.log(`GEMINI_API_KEY: ${maskKey(process.env.GEMINI_API_KEY)}`);
  console.log(`GEMINI_MODEL: ${process.env.GEMINI_MODEL || gemini.DEFAULT_MODEL}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? maskKey(process.env.OPENAI_API_KEY) : '(not set)'}`);
  console.log(`VERCEL: ${process.env.VERCEL || '0'}\n`);

  const geminiValid = gemini.isValidKey(process.env.GEMINI_API_KEY);
  console.log(`Gemini key format: ${geminiValid ? 'valid' : 'INVALID — set GEMINI_API_KEY in Vercel env'}\n`);
  if (!geminiValid) {
    process.exit(1);
  }

  await timed('Gemini hello (JSON)', () => gemini.generateJSONOnce({
    system: 'Return JSON only.',
    user: 'Return {"ok":true,"message":"hello"}',
    temperature: 0,
    timeoutMs: 15_000,
  }));

  const { system, user } = buildPlanBriefOnlyPrompt({
    brandProfile: { name: 'Corp Crunch', industry: 'Media', audience: 'Media professionals' },
    topics: [{ topic: 'AI in newsrooms' }],
    days: 30,
    channels: ['linkedin', 'instagram'],
    contentPrompt: 'Launch campaign for our new podcast about media innovation — focus on behind-the-scenes and guest teasers.',
  });

  const plan = await timed('Plan brief only (Vercel path)', () => gemini.generateJSONOnce({
    system,
    user,
    temperature: 0.72,
    timeoutMs: 20_000,
  }));

  if (plan.ok && plan.result) {
    const r = plan.result;
    console.log(`  name: ${r.name || '(none)'}`);
    console.log(`  pillars: ${(r.contentPillars || []).slice(0, 3).join(', ') || '(none)'}`);
    console.log(`  themeTopics: ${(r.themeTopics || []).length} topics`);
    if (r.themeTopics?.length) {
      console.log(`  sample: ${r.themeTopics.slice(0, 2).join(' | ')}`);
    }
  }

  console.log('\nDone. For production, ensure GEMINI_API_KEY is set in Vercel project settings.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
