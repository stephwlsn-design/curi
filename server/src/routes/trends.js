const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { scanTrends } = require('../services/moduleService');
const { saveTrends } = require('../services/growthService');
const Topic = require('../models/Topic');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { resolveIndustry } = require('../utils/workspaceGrowth');
const { buildFallbackTrends } = require('../utils/growthFallbacks');

const TREND_SCAN_COST = 3;

router.get('/preview', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const industry = resolveIndustry(workspace);
  res.json({
    trends: buildFallbackTrends(workspace.brandProfile, industry),
    industry,
    source: 'preview',
  });
});

router.post('/scan', async (req, res) => {
  const { workspaceId, industry: industryInput } = req.body;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const industry = resolveIndustry(workspace, industryInput);
  const user = await User.findById(req.user._id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  try {
    const canCharge = user.credits >= TREND_SCAN_COST;
    const result = canCharge
      ? await scanTrends({ brandProfile: workspace.brandProfile, industry })
      : {
        trends: buildFallbackTrends(workspace.brandProfile, industry),
        industry,
        source: 'fallback',
      };

    if (canCharge && result.source !== 'fallback') {
      await user.deductCredits(TREND_SCAN_COST);
    }

    res.json({
      trends: result.trends || [],
      industry: result.industry || industry,
      source: result.source || (canCharge ? 'ai' : 'fallback'),
      ...(canCharge ? {} : {
        warning: `Showing profile-based trends — ${TREND_SCAN_COST} credits required for a live AI scan`,
      }),
    });
  } catch (err) {
    res.json({
      trends: buildFallbackTrends(workspace.brandProfile, industry),
      industry,
      source: 'fallback',
      warning: err.message || 'Live scan unavailable — showing profile-based trends',
    });
  }
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
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const topics = await Topic.find({ workspace: workspaceId, status: 'active' })
    .sort({ relevance: -1, createdAt: -1 })
    .limit(50)
    .lean();

  res.json({
    trends: topics.map((topic) => ({
      topic: topic.topic,
      platform: topic.metadata?.platform || 'linkedin',
      relevance: topic.relevance || 70,
      contentIdea: topic.metadata?.contentIdea || '',
      hashtags: topic.metadata?.hashtags || [],
      _id: topic._id,
      saved: true,
    })),
    industry: workspace.brandProfile?.industry || null,
  });
});

router.get('/', async (req, res) => res.json({ module: 'trends', status: 'live' }));

module.exports = router;
