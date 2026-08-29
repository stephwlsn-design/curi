const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const {
  generateVideos,
  generateVideoBrief,
  getLibrary,
  favoriteVideo,
  updateVideo,
  formatVideoError,
} = require('../handlers/videoFast');

router.post('/brief', async (req, res) => {
  try {
    const payload = await generateVideoBrief({ user: req.user, body: req.body });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 502).json({ error: formatVideoError(err) });
  }
});

router.post('/generate', checkCredits(20), async (req, res) => {
  try {
    const result = await generateVideos({
      user: req.user,
      body: req.body,
      creditCost: req.creditCost,
    });
    await req.user.deductCredits(req.creditCost);
    res.status(201).json({
      videos: result.videos,
      source: result.source,
      warning: result.warning,
    });
  } catch (err) {
    res.status(err.status || 502).json({ error: formatVideoError(err) });
  }
});

router.get('/library', async (req, res) => {
  const { workspaceId } = req.query;
  const payload = await getLibrary({ workspaceId });
  res.json(payload);
});

router.post('/favorite/:id', async (req, res) => {
  try {
    const payload = await favoriteVideo({ videoId: req.params.id, userId: req.user._id });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { workspaceId, ...updates } = req.body;
    const payload = await updateVideo({
      videoId: req.params.id,
      userId: req.user._id,
      workspaceId,
      updates,
    });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
