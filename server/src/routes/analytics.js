const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const AutonomousRun = require('../models/AutonomousRun');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.get('/', async (req, res) => {
  const { workspaceId } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const [posts, images, videos, published, scheduled, runs] = await Promise.all([
    Content.countDocuments({ workspace: workspaceId, type: 'post' }),
    Content.countDocuments({ workspace: workspaceId, type: 'image' }),
    Content.countDocuments({ workspace: workspaceId, type: 'video' }),
    Content.countDocuments({ workspace: workspaceId, status: 'published' }),
    PublishJob.countDocuments({ workspace: workspaceId, status: 'queued' }),
    AutonomousRun.countDocuments({ workspace: workspaceId, status: 'completed' }),
  ]);

  const topContent = await Content.find({ workspace: workspaceId, status: 'published' })
    .sort({ 'analytics.impressions': -1 }).limit(5);

  res.json({
    stats: {
      postsGenerated: posts,
      imagesCreated: images,
      videosMade: videos,
      published,
      scheduled,
      autonomousRuns: runs,
    },
    workspace: workspace?.stats,
    topContent: topContent.map(c => ({
      id: c._id,
      title: c.title,
      platform: c.platform,
      analytics: c.analytics,
    })),
  });
});

router.post('/track/:contentId', async (req, res) => {
  const { impressions, clicks, likes, shares, comments, reach, saves } = req.body;
  const content = await Content.findByIdAndUpdate(
    req.params.contentId,
    {
      $set: {
        analytics: { impressions, clicks, likes, shares, comments, reach, saves },
      },
    },
    { new: true }
  );
  if (!content) return res.status(404).json({ error: 'Content not found' });
  res.json({ content });
});

module.exports = router;
