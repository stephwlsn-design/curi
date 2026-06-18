const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const launchService = require('../services/launchService');
const Campaign = require('../models/Campaign');

router.post('/campaign', checkCredits(50), async (req, res) => {
  const { workspaceId, goal, timeline = 30, budget } = req.body;

  const campaign = await Campaign.create({
    workspace: workspaceId, createdBy: req.user._id,
    name: goal.slice(0, 60), goal, status: 'generating', type: 'launch'
  });

  // Non-blocking generation — client polls status
  launchService.generateCampaign({ campaignId: campaign._id, workspaceId, goal, timeline, budget, userId: req.user._id })
    .catch(err => console.error('Campaign generation error', err));

  await req.user.deductCredits(req.creditCost);
  res.status(202).json({ campaign, message: 'Campaign generation started. Poll /api/launch/campaign/:id for status.' });
});

router.get('/campaign/:id', async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, createdBy: req.user._id }).populate('content');
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json({ campaign });
});

router.post('/campaign/:id/submit-for-approval', async (req, res) => {
  const { submitLaunchCampaignForApproval } = require('../services/approvalService');
  try {
    const { reviewCount, campaign } = await submitLaunchCampaignForApproval({
      campaignId: req.params.id,
      userId: req.user._id,
    });
    res.json({
      campaign,
      reviewCount,
      message: `${reviewCount} post${reviewCount === 1 ? '' : 's'} sent to approval queue`,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/campaigns', async (req, res) => {
  const { workspaceId } = req.query;
  const campaigns = await Campaign.find({ workspace: workspaceId }).sort({ createdAt: -1 }).limit(20);
  res.json({ campaigns });
});

module.exports = router;
