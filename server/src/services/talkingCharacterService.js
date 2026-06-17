const OpenAI = require('openai');
const logger = require('../utils/logger');

const TONALITIES = ['warm', 'professional', 'energetic', 'calm', 'friendly', 'bold', 'playful'];

const OPENAI_VOICE_MAP = {
  warm: 'nova',
  professional: 'onyx',
  energetic: 'fable',
  calm: 'shimmer',
  friendly: 'alloy',
  bold: 'echo',
  playful: 'nova',
};

const OPENAI_SPEED_MAP = {
  warm: 0.95,
  professional: 0.92,
  energetic: 1.12,
  calm: 0.86,
  friendly: 1.0,
  bold: 1.05,
  playful: 1.18,
};

const ELEVENLABS_VOICE_MAP = {
  warm: 'JBFqnCBsd6RMkjVDRZzb',
  professional: 'XrExE9yKIg1WjnnlVkGX',
  energetic: 'IKne3meq5aSn9XLyUdCD',
  calm: 'SAz9YHcvj6GT2YYXdXww',
  friendly: 'CwhRBWXzGAHq8TQ4Fs17',
  bold: 'pNInz6obpgDQGcFmaJgB',
  playful: 'FGY2WhTYpPnrIDTdsKH5',
};

const TONALITY_NAME_HINTS = {
  warm: ['Warm', 'George', 'Jessica', 'Bella'],
  professional: ['Professional', 'Matilda', 'Adam', 'Brian'],
  energetic: ['Energetic', 'Charlie', 'Liam', 'Laura'],
  calm: ['Relaxed', 'River', 'Will', 'Calm'],
  friendly: ['Casual', 'Roger', 'Chris', 'Friendly'],
  bold: ['Firm', 'Adam', 'Harry', 'Deep'],
  playful: ['Playful', 'Laura', 'Jessica', 'Quirky'],
};

const ELEVENLABS_STABILITY = {
  warm: 0.45,
  professional: 0.65,
  energetic: 0.35,
  calm: 0.7,
  friendly: 0.5,
  bold: 0.4,
  playful: 0.3,
};

let openaiClient = null;
let lastElevenLabsHint = null;
let premadeVoiceCache = null;
let premadeVoiceCacheAt = 0;
const PREMADE_CACHE_MS = 60 * 60 * 1000;

const getOpenAI = () => {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!openaiClient && key && key.length >= 20 && !key.includes('...')) {
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
};

const isValidKey = (key) => key && key.length >= 20 && !String(key).includes('...');

const parseElevenLabsError = async (response) => {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    if (detail?.status === 'missing_permissions') {
      return 'ElevenLabs API key is missing Text-to-Speech permissions — create a new key with full access in your ElevenLabs profile.';
    }
    if (response.status === 402) {
      return 'ElevenLabs free tier cannot use API voices — upgrade to Starter ($5/mo) or use Preview voice in the app.';
    }
    return `ElevenLabs error (${response.status})`;
  } catch {
    return `ElevenLabs error (${response.status})`;
  }
};

const fetchPremadeVoices = async (apiKey) => {
  if (premadeVoiceCache && Date.now() - premadeVoiceCacheAt < PREMADE_CACHE_MS) {
    return premadeVoiceCache;
  }
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) return null;
  const data = await response.json();
  premadeVoiceCache = (data.voices || []).filter((v) => v.category === 'premade');
  premadeVoiceCacheAt = Date.now();
  return premadeVoiceCache;
};

const resolveVoiceId = async (apiKey, tonality) => {
  const fallback = ELEVENLABS_VOICE_MAP[tonality] || ELEVENLABS_VOICE_MAP.friendly;
  const voices = await fetchPremadeVoices(apiKey);
  if (!voices?.length) return fallback;

  const hints = TONALITY_NAME_HINTS[tonality] || TONALITY_NAME_HINTS.friendly;
  for (const hint of hints) {
    const match = voices.find((v) => v.name?.includes(hint));
    if (match) return match.voice_id;
  }
  return voices[0].voice_id || fallback;
};

async function synthesizeWithElevenLabs({ text, tonality, language }) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!isValidKey(apiKey)) return null;

  const voiceId = await resolveVoiceId(apiKey, tonality);
  const stability = ELEVENLABS_STABILITY[tonality] ?? 0.5;

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      language_code: language?.split('-')[0] || undefined,
      voice_settings: {
        stability,
        similarity_boost: 0.75,
        style: tonality === 'playful' ? 0.6 : 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const hint = await parseElevenLabsError(response);
    lastElevenLabsHint = hint;
    logger.warn(`ElevenLabs TTS failed: ${hint}`);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    audioBase64: buffer.toString('base64'),
    mimeType: 'audio/mpeg',
    provider: 'elevenlabs',
    voiceId,
  };
}

async function synthesizeWithOpenAI({ text, tonality }) {
  const openai = getOpenAI();
  if (!openai) return null;

  const voice = OPENAI_VOICE_MAP[tonality] || OPENAI_VOICE_MAP.friendly;
  const speed = OPENAI_SPEED_MAP[tonality] ?? 1.0;

  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice,
      input: text.slice(0, 4096),
      speed,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      provider: 'openai',
      voice,
    };
  } catch (err) {
    logger.warn(`OpenAI TTS failed: ${err.message?.slice(0, 120)}`);
    return null;
  }
}

async function synthesizeSpeech({ text, language = 'en', tonality = 'friendly' }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const err = new Error('Script text is required');
    err.status = 400;
    throw err;
  }

  const tone = TONALITIES.includes(tonality) ? tonality : 'friendly';
  lastElevenLabsHint = null;

  let result = await synthesizeWithElevenLabs({ text: trimmed, tonality: tone, language });
  if (!result) {
    result = await synthesizeWithOpenAI({ text: trimmed, tonality: tone });
  }

  if (!result) {
    const err = new Error(
      lastElevenLabsHint
        || 'Voice generation unavailable — check ElevenLabs plan or OpenAI billing',
    );
    err.status = 503;
    err.code = 'TTS_UNAVAILABLE';
    err.hint = lastElevenLabsHint
      || 'Use Preview voice for instant browser speech while API billing is sorted.';
    throw err;
  }

  return {
    ...result,
    language,
    tonality: tone,
    characterCount: trimmed.length,
  };
}

module.exports = {
  TONALITIES,
  synthesizeSpeech,
};
