const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const createService = require('../services/createService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

// POST /api/create/post — generate single content piece
router.post('/post', checkCredits(1), async (req, res) => {
  const { workspaceId, platform, topic, tone, type } = req.body;

  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  try {
    const generated = await createService.generatePost({
      brandProfile: workspace.brandProfile,
      platform, topic, tone: tone || workspace.brandProfile?.voice || 'professional',
      type: type || 'social_post',
    });

    const content = await Content.create({
      workspace: workspaceId,
      createdBy: req.user._id,
      type: 'post',
      platform,
      content: generated.content,
      hashtags: generated.hashtags,
      emojis: generated.emojis,
      metadata: { topic, tone, characterCount: generated.content.length },
    });

    workspace.stats.postsGenerated = (workspace.stats.postsGenerated || 0) + 1;
    await workspace.save();
    await req.user.deductCredits(req.creditCost);

    res.status(201).json({ content });
  } catch (err) {
    const msg = err.message?.includes('quota') || err.status === 429
      ? 'AI quota exceeded — check your Gemini or OpenAI billing'
      : err.message?.includes('GEMINI') || err.message?.includes('API key')
        ? 'AI API key error — check GEMINI_API_KEY in server/.env'
        : err.message || 'Content generation failed';
    res.status(502).json({ error: msg });
  }
});

// POST /api/create/blog — generate blog article
router.post('/blog', checkCredits(10), async (req, res) => {
  const { workspaceId, topic, tone, wordCount = 800 } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  try {
    const generated = await createService.generateBlog({ brandProfile: workspace.brandProfile, topic, tone, wordCount });

    const content = await Content.create({
      workspace: workspaceId, createdBy: req.user._id, type: 'blog',
      title: generated.title, content: generated.content, metadata: { topic, wordCount }
    });

    await req.user.deductCredits(req.creditCost);
    res.status(201).json({ content });
  } catch (err) {
    const msg = err.message?.includes('quota') || err.status === 429
      ? 'AI quota exceeded — check your Gemini or OpenAI billing'
      : err.message?.includes('GEMINI') || err.message?.includes('API key')
        ? 'AI API key error — check GEMINI_API_KEY in server/.env'
        : err.message || 'Blog generation failed';
    res.status(502).json({ error: msg });
  }
});

// GET /api/create/history — get content history
router.get('/history', async (req, res) => {
  const { workspaceId, platform, type, page = 1, limit = 20 } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const query = { workspace: workspaceId };
  if (platform) query.platform = platform;
  if (type) query.type = type;

  const content = await Content.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate('createdBy', 'name avatar');

  const total = await Content.countDocuments(query);
  res.json({ content, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
});

// PATCH /api/create/:id — update content
router.patch('/:id', async (req, res) => {
  const { content, status, hashtags, workspaceId } = req.body;
  const update = {};
  if (content !== undefined) update.content = content;
  if (status !== undefined) update.status = status;
  if (hashtags !== undefined) update.hashtags = hashtags;

  const updated = await Content.findOneAndUpdate(
    { _id: req.params.id, workspace: workspaceId, createdBy: req.user._id },
    update,
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Content not found' });
  res.json({ content: updated });
});

module.exports = router;
