const logger = require('../utils/logger');

const FAL_MODEL = 'fal-ai/sadtalker';
const FAL_QUEUE_BASE = `https://queue.fal.run/${FAL_MODEL}`;
const FAL_STORAGE_INITIATE = 'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3';
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
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
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

const formatFalDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail.message) return detail.message;
  return null;
};

const buildFalError = (response, detailText = '') => {
  let body = {};
  try {
    body = detailText ? JSON.parse(detailText) : {};
  } catch {
    body = {};
  }
  const detail = formatFalDetail(body.detail) || detailText || `Fal API error (${response.status})`;
  const err = new Error(detail);
  err.status = response.status === 403 || response.status === 402 ? 402 : (response.status >= 500 ? 503 : 502);

  if (/exhausted balance|user is locked|insufficient credits/i.test(detail)) {
    err.code = 'FAL_BALANCE_EXHAUSTED';
    err.hint = 'Top up your fal.ai balance at https://fal.ai/dashboard/billing to enable lip-sync.';
  } else if (response.status === 401 || /unauthorized|invalid.*key/i.test(detail)) {
    err.code = 'FAL_AUTH_FAILED';
    err.hint = 'Check FAL_KEY or FAL_API_KEY in Vercel environment variables.';
  } else if (response.status === 422 || /face|no face|detect/i.test(detail)) {
    err.code = 'FAL_FACE_DETECT_FAILED';
    err.hint = 'Use a clear front-facing portrait with a visible face.';
  }

  return err;
};

async function uploadDataUrlToFal(apiKey, dataUrl, fallbackMime, filename) {
  const parsed = parseDataUrl(dataUrl, fallbackMime);
  if (!parsed?.buffer?.length) {
    const err = new Error('Invalid image or audio payload for lip-sync');
    err.status = 400;
    throw err;
  }

  const initRes = await fetch(FAL_STORAGE_INITIATE, {
    method: 'POST',
    headers: falHeaders(apiKey),
    body: JSON.stringify({
      file_name: filename,
      content_type: parsed.mime,
    }),
  });

  if (!initRes.ok) {
    const detail = await initRes.text().catch(() => '');
    logger.warn(`Fal storage initiate failed (${initRes.status}): ${detail.slice(0, 200)}`);
    throw buildFalError(initRes, detail);
  }

  const init = await initRes.json();
  const uploadUrl = init.upload_url;
  const fileUrl = init.file_url || init.file_access_url;
  if (!uploadUrl || !fileUrl) {
    const err = new Error('Fal storage did not return upload URLs');
    err.status = 502;
    throw err;
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': parsed.mime },
    body: parsed.buffer,
  });

  if (!putRes.ok) {
    const err = new Error('Failed to upload media to Fal CDN');
    err.status = 502;
    throw err;
  }

  return fileUrl;
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
    throw buildFalError(response, detail);
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
    const detail = await response.text().catch(() => '');
    throw buildFalError(response, detail);
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
    const detail = await response.text().catch(() => '');
    throw buildFalError(response, detail);
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
      const msg = formatFalDetail(status.error) || status.message || 'Lip-sync generation failed';
      const err = new Error(msg);
      err.status = 502;
      if (/face|detect/i.test(msg)) {
        err.code = 'FAL_FACE_DETECT_FAILED';
        err.hint = 'Use a clear front-facing portrait with a visible face.';
      }
      throw err;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { status: 'processing', requestId, provider: 'fal-sadtalker' };
}

async function checkFalAvailability() {
  const apiKey = getFalApiKey();
  if (!isValidKey(apiKey)) {
    return { configured: false, ok: false, reason: 'FAL_KEY or FAL_API_KEY not set' };
  }

  try {
    const response = await fetch(FAL_STORAGE_INITIATE, {
      method: 'POST',
      headers: falHeaders(apiKey),
      body: JSON.stringify({
        file_name: 'probe.txt',
        content_type: 'text/plain',
      }),
    });
    if (response.ok) {
      return { configured: true, ok: true, reason: 'ready' };
    }
    const detail = await response.text().catch(() => '');
    const err = buildFalError(response, detail);
    return { configured: true, ok: false, reason: err.message, code: err.code, hint: err.hint };
  } catch (e) {
    return { configured: true, ok: false, reason: e.message };
  }
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

  const imageUrl = await uploadDataUrlToFal(apiKey, imageDataUrl, 'image/jpeg', 'portrait.jpg');
  const audioUrl = await uploadDataUrlToFal(apiKey, audioDataUrl, 'audio/mpeg', 'speech.mp3');

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
    const msg = formatFalDetail(status.error) || status.message || 'Lip-sync generation failed';
    const err = new Error(msg);
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
  checkFalAvailability,
  getFalApiKey,
  isValidKey,
};
