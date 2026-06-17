const logger = require('../utils/logger');

const FAL_MODEL = 'fal-ai/sadtalker';
const FAL_QUEUE_BASE = `https://queue.fal.run/${FAL_MODEL}`;
const FAL_STORAGE_UPLOAD = 'https://fal.run/storage/upload';
const POLL_INTERVAL_MS = 2000;
const SERVER_POLL_BUDGET_MS = 55000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidKey = (key) => key && key.length >= 16 && !String(key).includes('...');

const getFalApiKey = () => (
  process.env.FAL_KEY?.trim()
  || process.env.FAL_API_KEY?.trim()
  || ''
);

const normalizeStatus = (status) => String(status || '').toUpperCase();

const parseDataUrl = (dataUrl, fallbackMime) => {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
      mime: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }
  return {
    mime: fallbackMime,
    buffer: Buffer.from(dataUrl, 'base64'),
  };
};

const falHeaders = (apiKey, json = true) => {
  const headers = { Authorization: `Key ${apiKey}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
};

const extractVideoUrl = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  return payload?.video?.url
    || payload?.data?.video?.url
    || payload?.output?.video?.url
    || payload?.response?.video?.url
    || null;
};

async function uploadDataUrlToFal(apiKey, dataUrl, fallbackMime, filename) {
  const parsed = parseDataUrl(dataUrl, fallbackMime);
  if (!parsed?.buffer?.length) {
    const err = new Error('Invalid image or audio payload for lip-sync');
    err.status = 400;
    throw err;
  }

  const form = new FormData();
  const blob = new Blob([parsed.buffer], { type: parsed.mime });
  form.append('file', blob, filename);

  const response = await fetch(FAL_STORAGE_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.warn(`Fal storage upload failed (${response.status}): ${detail.slice(0, 200)}`);
    const err = new Error('Could not upload media for lip-sync');
    err.status = 502;
    throw err;
  }

  const payload = await response.json();
  const url = payload?.url || payload?.file_url;
  if (!url) {
    const err = new Error('Fal storage did not return a file URL');
    err.status = 502;
    throw err;
  }
  return url;
}

async function submitSadTalkerJob({ apiKey, imageUrl, audioUrl, portrait = true }) {
  const response = await fetch(FAL_QUEUE_BASE, {
    method: 'POST',
    headers: falHeaders(apiKey),
    body: JSON.stringify({
      source_image_url: imageUrl,
      driven_audio_url: audioUrl,
      face_model_resolution: '512',
      expression_scale: 1.1,
      preprocess: portrait ? 'crop' : 'full',
      still_mode: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.warn(`SadTalker submit failed (${response.status}): ${detail.slice(0, 300)}`);
    const err = new Error(detail?.slice(0, 120) || 'Could not start lip-sync job');
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

async function fetchPayloadFromUrl(apiKey, url) {
  const response = await fetch(url, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!response.ok) {
    const err = new Error('Could not fetch lip-sync result');
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function fetchSadTalkerResult(apiKey, requestId, statusPayload = null) {
  if (statusPayload?.response_url) {
    const payload = await fetchPayloadFromUrl(apiKey, statusPayload.response_url);
    const videoUrl = extractVideoUrl(payload);
    if (videoUrl) {
      return {
        videoUrl,
        requestId,
        provider: 'fal-sadtalker',
        contentType: payload?.video?.content_type || 'video/mp4',
      };
    }
  }

  const response = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!response.ok) {
    const err = new Error('Could not fetch lip-sync result');
    err.status = response.status;
    throw err;
  }
  const payload = await response.json();
  const videoUrl = extractVideoUrl(payload);
  if (!videoUrl) {
    logger.warn(`SadTalker result missing video: ${JSON.stringify(payload).slice(0, 300)}`);
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
    const state = normalizeStatus(status.status);
    if (state === 'COMPLETED') {
      return fetchSadTalkerResult(apiKey, requestId, status);
    }
    if (state === 'FAILED' || state === 'CANCELLED') {
      const err = new Error(status.error || status.message || 'Lip-sync generation failed');
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
    err.hint = 'Add FAL_KEY or FAL_API_KEY in Vercel environment variables, then redeploy.';
    throw err;
  }

  if (!imageDataUrl || !audioDataUrl) {
    const err = new Error('Image and audio are required for lip-sync');
    err.status = 400;
    throw err;
  }

  let imageUrl;
  let audioUrl;
  try {
    imageUrl = await uploadDataUrlToFal(apiKey, imageDataUrl, 'image/jpeg', 'portrait.jpg');
    audioUrl = await uploadDataUrlToFal(apiKey, audioDataUrl, 'audio/mpeg', 'speech.mp3');
  } catch (uploadErr) {
    logger.warn(`Fal upload failed, trying inline data URLs: ${uploadErr.message}`);
    const image = imageDataUrl.startsWith('data:') ? imageDataUrl : `data:image/jpeg;base64,${imageDataUrl}`;
    const audio = audioDataUrl.startsWith('data:') ? audioDataUrl : `data:audio/mpeg;base64,${audioDataUrl}`;
    imageUrl = image;
    audioUrl = audio;
  }

  const requestId = await submitSadTalkerJob({
    apiKey,
    imageUrl,
    audioUrl,
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
  const state = normalizeStatus(status.status);
  if (state === 'COMPLETED') {
    return fetchSadTalkerResult(apiKey, requestId, status);
  }
  if (state === 'FAILED' || state === 'CANCELLED') {
    const err = new Error(status.error || status.message || 'Lip-sync generation failed');
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
