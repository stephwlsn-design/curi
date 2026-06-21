const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { scanTrends } = require('../services/moduleService');
const { saveTrends } = require('../services/growthService');
const Topic = require('../models/Topic');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/scan', checkCredits(3), async (req, res) => {
  const { workspaceId, industry } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await scanTrends({ brandProfile: workspace.brandProfile, industry });
  await req.user.deductCredits(req.creditCost);

  res.json({ trends: result.trends || [] });
});

router.post('/save', async (req, res) => {
  const { workspaceId, trends = [], industry } = req.body;
  if (!trends.length) return res.status(400).json({ error: 'No trends to save' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await saveTrends({
    workspaceId: workspace._id,
    userId: req.user._id,
    trends,
    industry,
  });

  res.json({
    ...result,
    message: `${result.count} trends saved`,
  });
});

router.get('/saved', async (req, res) => {
  const { workspaceId } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const topics = await Topic.find({ workspace: workspaceId, status: 'active' })
    .sort({ relevance: -1, createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ trends: topics });
});

router.get('/', async (req, res) => res.json({ module: 'trends', status: 'live' }));

module.exports = router;
