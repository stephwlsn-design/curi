const logger = require('../utils/logger');

const FAL_MODEL = 'fal-ai/sadtalker';
const FAL_QUEUE_BASE = `https://queue.fal.run/${FAL_MODEL}`;
const POLL_INTERVAL_MS = 2500;
const SERVER_POLL_BUDGET_MS = 52000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidKey = (key) => key && key.length >= 16 && !String(key).includes('...');

const getFalApiKey = () => (
  process.env.FAL_KEY?.trim()
  || process.env.FAL_API_KEY?.trim()
  || ''
);

const toDataUrl = (value, fallbackMime) => {
  if (!value) return null;
  if (value.startsWith('data:')) return value;
  return `data:${fallbackMime};base64,${value}`;
};

const falHeaders = (apiKey) => ({
  Authorization: `Key ${apiKey}`,
  'Content-Type': 'application/json',
});

async function submitSadTalkerJob({ apiKey, imageDataUrl, audioDataUrl, portrait = true }) {
  const response = await fetch(FAL_QUEUE_BASE, {
    method: 'POST',
    headers: falHeaders(apiKey),
    body: JSON.stringify({
      source_image_url: imageDataUrl,
      driven_audio_url: audioDataUrl,
      face_model_resolution: '512',
      expression_scale: 1.05,
      preprocess: portrait ? 'crop' : 'full',
      still_mode: !portrait,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.warn(`SadTalker submit failed (${response.status}): ${detail.slice(0, 200)}`);
    const err = new Error('Could not start lip-sync job');
    err.status = response.status >= 500 ? 503 : 502;
    throw err;
  }

  const payload = await response.json();
  const requestId = payload.request_id || payload.requestId;
  if (!requestId) {
    const err = new Error('Lip-sync provider returned no job id');
    err.status = 502;
    throw err;
  }
  return requestId;
}

async function fetchSadTalkerStatus(apiKey, requestId) {
  const response = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!response.ok) {
    const err = new Error('Could not check lip-sync status');
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function fetchSadTalkerResult(apiKey, requestId) {
  const response = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!response.ok) {
    const err = new Error('Could not fetch lip-sync result');
    err.status = response.status;
    throw err;
  }
  const payload = await response.json();
  const videoUrl = payload?.video?.url
    || payload?.data?.video?.url
    || payload?.response?.video?.url;
  if (!videoUrl) {
    const err = new Error('Lip-sync completed without a video');
    err.status = 502;
    throw err;
  }
  return {
    videoUrl,
    requestId,
    provider: 'fal-sadtalker',
    contentType: payload?.video?.content_type || 'video/mp4',
  };
}

async function pollUntilReady(apiKey, requestId, budgetMs = SERVER_POLL_BUDGET_MS) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const status = await fetchSadTalkerStatus(apiKey, requestId);
    if (status.status === 'COMPLETED') {
      return fetchSadTalkerResult(apiKey, requestId);
    }
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      const err = new Error(status.error || 'Lip-sync generation failed');
      err.status = 502;
      throw err;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { status: 'processing', requestId, provider: 'fal-sadtalker' };
}

async function generateLipSyncVideo({
  imageDataUrl,
  audioDataUrl,
  portrait = true,
}) {
  const apiKey = getFalApiKey();
  if (!isValidKey(apiKey)) {
    const err = new Error('Lip-sync is not configured on the server');
    err.status = 503;
    err.code = 'LIPSYNC_UNAVAILABLE';
    err.hint = 'Add FAL_KEY or FAL_API_KEY to your environment (get one at fal.ai) to enable real lip dubbing.';
    throw err;
  }

  const image = toDataUrl(imageDataUrl, 'image/jpeg');
  const audio = toDataUrl(audioDataUrl, 'audio/mpeg');
  if (!image || !audio) {
    const err = new Error('Image and audio are required for lip-sync');
    err.status = 400;
    throw err;
  }

  const requestId = await submitSadTalkerJob({
    apiKey,
    imageDataUrl: image,
    audioDataUrl: audio,
    portrait,
  });

  return pollUntilReady(apiKey, requestId);
}

async function getLipSyncJob(requestId) {
  const apiKey = getFalApiKey();
  if (!isValidKey(apiKey)) {
    const err = new Error('Lip-sync is not configured');
    err.status = 503;
    throw err;
  }
  if (!requestId) {
    const err = new Error('Job id is required');
    err.status = 400;
    throw err;
  }

  const status = await fetchSadTalkerStatus(apiKey, requestId);
  if (status.status === 'COMPLETED') {
    return fetchSadTalkerResult(apiKey, requestId);
  }
  if (status.status === 'FAILED' || status.status === 'CANCELLED') {
    const err = new Error(status.error || 'Lip-sync generation failed');
    err.status = 502;
    throw err;
  }
  return {
    status: 'processing',
    requestId,
    provider: 'fal-sadtalker',
    queueStatus: status.status,
  };
}

module.exports = {
  generateLipSyncVideo,
  getLipSyncJob,
};
