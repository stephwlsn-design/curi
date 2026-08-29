const Content = require('../models/Content');
const videoService = require('../services/videoService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const formatVideoError = (err) => {
  const msg = err.message || '';
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'Video generation timed out — try again with a shorter brief';
  }
  if (msg.includes('quota') || err.status === 429) {
    return 'AI quota exceeded — check your Gemini or OpenAI billing';
  }
  if (msg.includes('GEMINI') || msg.includes('API key')) {
    return 'AI API key error — check GEMINI_API_KEY in server/.env';
  }
  return msg || 'Video generation failed';
};

const mapSavedVideos = (saved) => saved.map((c) => ({
  ...(c.metadata?.toObject?.() ?? c.metadata ?? {}),
  _id: c._id,
}));

const createSaveGate = () => {
  let active = false;
  return {
    saveOnce: async (fn) => {
      if (active) return null;
      active = true;
      try {
        return await fn();
      } finally {
        // Keep active=true so late finishers never persist twice
      }
    },
  };
};

const persistGeneratedVideos = async ({
  workspace,
  workspaceId,
  user,
  videos,
  source,
}) => {
  const saved = await Promise.all(videos.map((v) => Content.create({
    workspace: workspaceId,
    createdBy: user._id,
    type: 'video',
    platform: 'universal',
    title: v.title,
    content: v.hook,
    metadata: { ...v, module: 'video', source },
    status: 'draft',
  })));

  workspace.stats.videosGenerated = (workspace.stats.videosGenerated || 0) + saved.length;
  await workspace.save();

  return saved;
};

const generateVideos = async ({ user, body, creditCost = 20, saveGate }) => {
  const {
    workspaceId,
    prompt,
    narrationBrief = '',
    creativeBrief = '',
    videoType = 'motion_graphics',
    style = 'professional',
    voice = 'professional',
    duration = 30,
  } = body;

  if (!prompt?.trim() && !narrationBrief?.trim() && !creativeBrief?.trim()) {
    const err = new Error('Prompt is required');
    err.status = 400;
    throw err;
  }

  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const combinedPrompt = videoService.combineBriefForGenerate(creativeBrief, narrationBrief)
    || String(prompt || '').trim();

  const { videos, source, warning } = await videoService.generateVideos({
    brandProfile: workspace.brandProfile,
    onboarding: workspace.onboarding,
    prompt: combinedPrompt,
    narrationBrief: String(narrationBrief || '').trim(),
    creativeBrief: String(creativeBrief || '').trim(),
    videoType,
    style,
    voice,
    duration,
  });

  if (!videos.length) {
    const err = new Error('Video could not be generated — try again with a shorter brief');
    err.status = 502;
    throw err;
  }

  const persist = () => persistGeneratedVideos({
    workspace,
    workspaceId,
    user,
    videos,
    source,
  });

  const saved = saveGate
    ? await saveGate.saveOnce(persist)
    : await persist();

  if (!saved) {
    return { videos: [], source, warning, creditCost, skipped: true };
  }

  return {
    videos: mapSavedVideos(saved),
    source,
    warning,
    creditCost,
  };
};

const getLibrary = async ({ workspaceId }) => {
  const videos = await Content.find({ workspace: workspaceId, type: 'video' })
    .sort({ createdAt: -1 })
    .limit(50);
  return { videos };
};

const favoriteVideo = async ({ videoId, userId }) => {
  const item = await Content.findOneAndUpdate(
    { _id: videoId, createdBy: userId, 'metadata.module': 'video' },
    { $set: { 'metadata.favorited': true } },
    { new: true },
  );
  if (!item) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }
  return { video: item };
};

const updateVideo = async ({ videoId, userId, workspaceId, updates }) => {
  const workspace = await findAccessibleWorkspace(workspaceId, userId);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const item = await Content.findOne({
    _id: videoId,
    workspace: workspaceId,
    createdBy: userId,
    type: 'video',
  });
  if (!item) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }

  const { workspaceId: _ignored, title, hook, cta, scenes, captions, highlightWords, ...rest } = updates || {};
  const patch = {
    ...(title !== undefined ? { title } : {}),
    ...(hook !== undefined ? { hook } : {}),
    ...(cta !== undefined ? { cta } : {}),
    ...(scenes !== undefined ? { scenes } : {}),
    ...(captions !== undefined ? { captions } : {}),
    ...(highlightWords !== undefined ? { highlightWords } : {}),
    ...rest,
    editedAt: new Date(),
  };

  const metadata = { ...(item.metadata || {}), ...patch, module: 'video' };
  if (title) item.title = title;
  if (hook) item.content = hook;
  item.metadata = metadata;
  await item.save();

  return {
    video: {
      ...(item.metadata?.toObject?.() ?? item.metadata ?? {}),
      _id: item._id,
    },
  };
};

const generateVideoBrief = async ({ user, body }) => {
  const {
    workspaceId,
    videoType = 'motion_graphics',
    style = 'professional',
    duration = 30,
    topicHint = '',
  } = body;

  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const params = {
    brandProfile: workspace.brandProfile,
    onboarding: workspace.onboarding,
    videoType,
    style,
    duration,
    topicHint,
  };

  try {
    return await videoService.generateVideoBrief(params);
  } catch {
    return {
      ...videoService.buildFallbackBrief(params),
      warning: 'Drafted from brand profile — edit before creating video',
    };
  }
};

const generateVideosEmergency = async ({ user, body, creditCost = 20, saveGate }) => {
  const {
    workspaceId,
    prompt,
    narrationBrief = '',
    creativeBrief = '',
    videoType = 'motion_graphics',
    style = 'professional',
    voice = 'professional',
    duration = 30,
  } = body;

  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const combinedPrompt = videoService.combineBriefForGenerate(creativeBrief, narrationBrief)
    || String(prompt || '').trim();

  const { videos, source, warning } = videoService.generateVideosEmergency({
    brandProfile: workspace.brandProfile,
    prompt: combinedPrompt,
    narrationBrief: String(narrationBrief || '').trim(),
    creativeBrief: String(creativeBrief || '').trim(),
    videoType,
    style,
    voice,
    duration,
  });

  const persist = () => persistGeneratedVideos({
    workspace,
    workspaceId,
    user,
    videos,
    source,
  });

  const saved = saveGate
    ? await saveGate.saveOnce(persist)
    : await persist();

  if (!saved) {
    return { videos: [], source, warning, creditCost, skipped: true };
  }

  return {
    videos: mapSavedVideos(saved),
    source,
    warning,
    creditCost,
  };
};

module.exports = {
  generateVideos,
  generateVideosEmergency,
  generateVideoBrief,
  getLibrary,
  favoriteVideo,
  updateVideo,
  formatVideoError,
  createSaveGate,
};
