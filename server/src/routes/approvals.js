const express = require('express');
const router = express.Router();
const {
  getQueue,
  submitForReview,
  approveContent,
  rejectContent,
  scheduleContent,
} = require('../services/approvalService');

router.get('/queue', async (req, res) => {
  const { workspaceId, status = 'review' } = req.query;
  try {
    const payload = await getQueue({ workspaceId, userId: req.user._id, status });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/submit/:id', async (req, res) => {
  try {
    const item = await submitForReview({
      contentId: req.params.id,
      workspaceId: req.body.workspaceId,
      userId: req.user._id,
    });
    res.json({ item });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/approve/:id', async (req, res) => {
  try {
    const item = await approveContent({
      contentId: req.params.id,
      workspaceId: req.body.workspaceId,
      userId: req.user._id,
      schedule: req.body.schedule !== false,
    });
    res.json({ item });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/reject/:id', async (req, res) => {
  try {
    const item = await rejectContent({
      contentId: req.params.id,
      workspaceId: req.body.workspaceId,
      userId: req.user._id,
      reason: req.body.reason,
    });
    res.json({ item });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/publish/:id', async (req, res) => {
  try {
    const item = await scheduleContent({
      contentId: req.params.id,
      workspaceId: req.body.workspaceId,
      userId: req.user._id,
      scheduledAt: req.body.scheduledAt,
    });
    res.json({ item });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
