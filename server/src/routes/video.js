const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const videoService = require('../services/videoService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/generate', checkCredits(20), async (req, res) => {
  const {
    workspaceId, prompt, videoType = 'motion_graphics', style = 'professional',
    voice = 'professional', variantCount = 5, duration = 30,
  } = req.body;

  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  try {
    const videos = await videoService.generateVideos({
      brandProfile: workspace.brandProfile,
      prompt, videoType, style, voice, variantCount, duration,
    });

    const saved = await Promise.all(videos.map(v =>
      Content.create({
        workspace: workspaceId,
        createdBy: req.user._id,
        type: 'video',
        platform: 'universal',
        title: v.title,
        content: v.hook,
        metadata: { ...v, module: 'video' },
        status: 'draft',
      })
    ));

    workspace.stats.videosGenerated = (workspace.stats.videosGenerated || 0) + saved.length;
    await workspace.save();
    await req.user.deductCredits(req.creditCost);

    res.status(201).json({
      videos: saved.map(c => ({ ...(c.metadata?.toObject?.() ?? c.metadata ?? {}), _id: c._id })),
    });
  } catch (err) {
    const msg = err.message?.includes('quota') || err.status === 429
      ? 'AI quota exceeded — check your Gemini or OpenAI billing'
      : err.message?.includes('GEMINI') || err.message?.includes('API key')
        ? 'AI API key error — check GEMINI_API_KEY in server/.env'
        : err.message || 'Video generation failed';
    res.status(502).json({ error: msg });
  }
});

router.get('/library', async (req, res) => {
  const { workspaceId } = req.query;
  const videos = await Content.find({ workspace: workspaceId, type: 'video' })
    .sort({ createdAt: -1 }).limit(50);
  res.json({ videos });
});

router.post('/favorite/:id', async (req, res) => {
  const item = await Content.findOneAndUpdate(
    { _id: req.params.id, 'metadata.module': 'video' },
    { $set: { 'metadata.favorited': true } },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: 'Video not found' });
  res.json({ video: item });
});

module.exports = router;
