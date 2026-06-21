const Content = require('../models/Content');
const CalendarEntry = require('../models/CalendarEntry');
const Campaign = require('../models/Campaign');
const mongoose = require('mongoose');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { scheduleContent: enqueueSchedule } = require('./designUploadService');

const runIdFilter = (runId) => ({
  $or: [
    { 'metadata.runId': String(runId) },
    { 'metadata.runId': runId },
  ],
});

const getQueue = async ({ workspaceId, userId, status = 'review' }) => {
  const workspace = await findAccessibleWorkspace(workspaceId, userId);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const filter = { workspace: workspaceId };
  if (status !== 'all') filter.status = status;

  const items = await Content.find(filter)
    .populate('calendarEntry', 'day platform publishTime topic type')
    .populate('campaign', 'name goal')
    .sort({
      'metadata.suggestedScheduledAt': 1,
      createdAt: -1,
    })
    .limit(100)
    .lean();

  const wsId = new mongoose.Types.ObjectId(String(workspaceId));
  const counts = await Content.aggregate([
    { $match: { workspace: wsId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const statusCounts = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  return { items, statusCounts };
};

const verifyContent = async (contentId, workspaceId, userId) => {
  const workspace = await findAccessibleWorkspace(workspaceId, userId);
  if (!workspace) return null;
  return Content.findOne({ _id: contentId, workspace: workspaceId });
};

const submitForReview = async ({ contentId, workspaceId, userId }) => {
  const item = await verifyContent(contentId, workspaceId, userId);
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }
  item.status = 'review';
  await item.save();
  return item;
};

const approveContent = async ({ contentId, workspaceId, userId, schedule = true }) => {
  const item = await verifyContent(contentId, workspaceId, userId);
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }

  const suggestedAt = item.metadata?.suggestedScheduledAt;
  if (schedule && suggestedAt) {
    const { content: scheduled } = await enqueueSchedule({
      content: item,
      platform: item.metadata?.suggestedPlatform || item.platform,
      scheduledAt: suggestedAt,
      workspaceId: item.workspace,
      userId,
    });
    return scheduled;
  }
  item.status = 'approved';
  item.approvedBy = userId;
  item.approvedAt = new Date();
  await item.save();
  return item;
};

const rejectContent = async ({ contentId, workspaceId, userId, reason = 'Needs revision' }) => {
  const item = await verifyContent(contentId, workspaceId, userId);
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }
  item.status = 'draft';
  item.metadata = { ...(item.metadata?.toObject?.() ?? item.metadata ?? {}), rejectionReason: reason };
  item.markModified('metadata');
  await item.save();
  return item;
};

const scheduleContent = async ({ contentId, workspaceId, userId, scheduledAt, platform }) => {
  const item = await Content.findOne({
    _id: contentId,
    workspace: workspaceId,
    status: { $in: ['approved', 'review', 'draft', 'scheduled'] },
  });
  if (!item) {
    const err = new Error('Content not found or not schedulable');
    err.status = 404;
    throw err;
  }
  const workspace = await findAccessibleWorkspace(workspaceId, userId);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  const when = scheduledAt ? new Date(scheduledAt) : new Date();
  const { content } = await enqueueSchedule({
    content: item,
    platform: platform || item.metadata?.suggestedPlatform || item.platform,
    scheduledAt: when,
    workspaceId: workspace._id,
    userId,
  });
  return content;
};

const submitAutonomousRunForApproval = async ({ runId, userId }) => {
  const AutonomousRun = require('../models/AutonomousRun');
  const run = await AutonomousRun.findOne({ _id: runId, createdBy: userId });
  if (!run) {
    const err = new Error('Run not found');
    err.status = 404;
    throw err;
  }

  const runFilter = runIdFilter(runId);
  const entries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
  let positioned = 0;

  for (const entry of entries) {
    if (!entry.content) continue;
    const scheduledAt = predictPublishTime(entry.platform, entry.day, entry.publishTime);
    await Content.findByIdAndUpdate(entry.content, {
      $set: {
        status: 'review',
        'metadata.suggestedScheduledAt': scheduledAt,
        'metadata.suggestedPlatform': entry.platform,
        'metadata.campaignDay': entry.day,
        'metadata.module': 'autonomous',
      },
    });
    positioned += 1;
  }

  await Content.updateMany(
    {
      workspace: run.workspace,
      ...runFilter,
      status: { $nin: ['published', 'scheduled'] },
    },
    { $set: { status: 'review', 'metadata.module': 'autonomous' } },
  );

  const reviewCount = await Content.countDocuments({
    workspace: run.workspace,
    ...runFilter,
    status: 'review',
  });

  const scoringStep = run.steps?.find((s) => s.name === 'Creative Scoring');
  if (scoringStep && scoringStep.status !== 'completed') {
    scoringStep.status = 'completed';
    scoringStep.completedAt = new Date();
    scoringStep.summary = `${reviewCount} assets queued for approval`;
  }

  const approvalStep = run.steps?.find((s) => s.name === 'Approval & Scheduling');
  if (approvalStep && approvalStep.status !== 'completed') {
    approvalStep.status = 'completed';
    approvalStep.completedAt = new Date();
    approvalStep.summary = `${positioned || reviewCount} items positioned for approval`;
  }

  run.stats.approved = 0;
  run.stats.scheduled = 0;
  run.markModified('steps');
  await run.save();

  return { reviewCount, positioned, run };
};

const submitLaunchCampaignForApproval = async ({ campaignId, userId }) => {
  const campaign = await Campaign.findOne({ _id: campaignId, createdBy: userId });
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }

  const contentIds = (campaign.content || []).filter(Boolean);
  if (!contentIds.length) {
    const err = new Error('Campaign has no content to review');
    err.status = 400;
    throw err;
  }

  const base = new Date();
  const updates = contentIds.map((id, index) => {
    const scheduledAt = new Date(base);
    scheduledAt.setDate(scheduledAt.getDate() + index + 1);
    scheduledAt.setHours(9, 0, 0, 0);
    return Content.findByIdAndUpdate(id, {
      $set: {
        status: 'review',
        'metadata.module': 'launch',
        'metadata.campaignId': String(campaign._id),
        'metadata.campaignGoal': campaign.goal,
        'metadata.suggestedScheduledAt': scheduledAt,
      },
    });
  });
  await Promise.all(updates);

  campaign.status = 'review';
  await campaign.save();

  const reviewCount = await Content.countDocuments({
    _id: { $in: contentIds },
    status: 'review',
  });

  return { reviewCount, campaign };
};

const approveAllScheduled = async ({ workspaceId, userId, runId }) => {
  const filter = {
    workspace: workspaceId,
    status: 'review',
    'metadata.suggestedScheduledAt': { $exists: true, $ne: null },
  };
  if (runId) filter['metadata.runId'] = String(runId);

  const items = await Content.find(filter).sort({ 'metadata.suggestedScheduledAt': 1 }).limit(100);
  if (!items.length) {
    const err = new Error('No review items with suggested publish dates found');
    err.status = 404;
    throw err;
  }

  let scheduled = 0;
  const errors = [];
  for (const item of items) {
    try {
      await approveContent({
        contentId: item._id,
        workspaceId,
        userId,
        schedule: true,
      });
      scheduled += 1;
    } catch (err) {
      errors.push({ contentId: item._id, error: err.message });
    }
  }

  return { scheduled, total: items.length, errors };
};

const predictPublishTime = (platform, day, baseTime = '09:00') => {
  const offsets = { linkedin: 8, instagram: 11, twitter: 12, tiktok: 18, facebook: 10 };
  const hour = offsets[platform] || parseInt(String(baseTime).split(':')[0], 10);
  const date = new Date();
  date.setDate(date.getDate() + day);
  date.setHours(hour, 0, 0, 0);
  return date;
};

module.exports = {
  getQueue,
  submitForReview,
  approveContent,
  approveAllScheduled,
  rejectContent,
  scheduleContent,
  submitAutonomousRunForApproval,
  submitLaunchCampaignForApproval,
  runIdFilter,
};
