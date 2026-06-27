const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const launchService = require('../services/launchService');
const { enqueueLaunchCampaign } = require('../workers');
const { listAccountsForUser } = require('../services/socialAccountService');
const Campaign = require('../models/Campaign');

router.post('/campaign', checkCredits(50), async (req, res) => {
  const {
    workspaceId,
    goal,
    timeline = 30,
    budget,
    platforms,
    sourceContentId,
    designIds,
    topic,
    scheduleMode = 'immediate',
    scheduleStartAt,
  } = req.body;

  const requested = (platforms || []).filter(Boolean);
  if (!requested.length) {
    return res.status(400).json({ error: 'Select at least one social channel to launch' });
  }

  const connected = new Set(
    listAccountsForUser(req.user).filter((a) => a.connected).map((a) => a.platform),
  );
  const missingPlatforms = requested.filter((p) => !connected.has(p));
  if (missingPlatforms.length) {
    return res.status(400).json({
      error: `Connect ${missingPlatforms.join(', ')} in Social Channels before launching`,
      missingPlatforms,
      needsIntegrations: true,
    });
  }

  const isScheduled = scheduleMode === 'scheduled' && scheduleStartAt;
  let startDate = new Date();
  if (isScheduled) {
    startDate = new Date(scheduleStartAt);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid schedule date' });
    }
    if (startDate <= new Date()) {
      return res.status(400).json({ error: 'Schedule date must be in the future' });
    }
  } else {
    startDate.setHours(9, 0, 0, 0);
  }
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(timeline));

  const launchPayload = {
    campaignId: null,
    workspaceId,
    goal,
    timeline,
    budget,
    userId: req.user._id,
    platforms: requested,
    sourceContentId,
    designIds,
    topic,
    scheduleMode: isScheduled ? 'scheduled' : 'immediate',
    scheduleStartAt: isScheduled ? startDate.toISOString() : undefined,
  };

  const campaign = await Campaign.create({
    workspace: workspaceId,
    createdBy: req.user._id,
    name: goal.slice(0, 60),
    goal,
    status: 'generating',
    type: 'launch',
    timeline,
    budget,
    platforms: requested,
    scheduleMode: isScheduled ? 'scheduled' : 'immediate',
    scheduledLaunchAt: isScheduled ? startDate : undefined,
    startDate,
    endDate,
    sourceContent: {
      contentId: sourceContentId || undefined,
      designIds: designIds || [],
      topic,
    },
    metadata: {
      launchPayload: { ...launchPayload, campaignId: undefined },
      launchPhase: 'init',
    },
  });

  launchPayload.campaignId = campaign._id;
  campaign.metadata.launchPayload = launchPayload;
  await campaign.save();

  enqueueLaunchCampaign(launchPayload);

  let result;
  try {
    result = await launchService.advanceLaunchCampaign({
      campaignId: campaign._id,
      userId: req.user._id,
      maxSteps: 2,
      maxMs: 12_000,
    });
  } catch (err) {
    result = {
      done: false,
      campaign: await Campaign.findById(campaign._id).populate('content').lean(),
      integrationStatus: launchService.getLaunchIntegrationStatus(req.user, requested),
      progressMessage: 'Launch started — generating posts…',
    };
  }

  await req.user.deductCredits(req.creditCost);
  res.status(202).json({
    campaign: result.campaign || campaign,
    integrationStatus: result.integrationStatus,
    progressMessage: result.progressMessage,
    message: 'Campaign generation started. Poll /api/launch/campaign/:id/advance for status.',
  });
});

router.post('/campaign/:id/advance', async (req, res) => {
  try {
    const result = await launchService.advanceLaunchCampaign({
      campaignId: req.params.id,
      userId: req.user._id,
    });
    if (!result.campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/campaign/:id', async (req, res) => {
  await launchService.recoverStaleCampaigns(req.user._id);
  await launchService.recoverCampaignIfStuck(req.params.id, req.user._id);

  const campaign = await Campaign.findOne({ _id: req.params.id, createdBy: req.user._id })
    .populate('content')
    .populate('sourceContent.contentId', 'content platform title hashtags')
    .lean();

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const integrationStatus = launchService.getLaunchIntegrationStatus(req.user, campaign.platforms || []);

  res.json({
    campaign,
    integrationStatus,
    progressMessage: launchService.buildLaunchProgressMessage(campaign, integrationStatus),
  });
});

router.post('/campaign/:id/schedule', async (req, res) => {
  const { scheduleStartAt, workspaceId } = req.body;
  try {
    const result = await launchService.scheduleLaunchCampaign({
      campaignId: req.params.id,
      userId: req.user._id,
      workspaceId,
      scheduleStartAt,
    });
    res.json({
      ...result,
      message: `${result.scheduled} post${result.scheduled === 1 ? '' : 's'} scheduled`,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
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

router.get('/overview', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
  try {
    await launchService.recoverStaleCampaigns(req.user._id);
    const overview = await launchService.getLaunchOverview({ workspaceId, userId: req.user._id });
    res.json(overview);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/campaigns', async (req, res) => {
  const { workspaceId } = req.query;
  await launchService.recoverStaleCampaigns(req.user._id);

  const campaigns = await Campaign.find({ workspace: workspaceId, createdBy: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('content', 'platform status metadata')
    .lean();

  res.json({ campaigns });
});

module.exports = router;
