const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const { normalizePlatform } = require('./socialAccountService');

const toPublicUrl = (filename) => `/api/uploads/user-designs/${filename}`;

const scheduleContent = async ({
  content,
  contentId,
  platform,
  scheduledAt,
  workspaceId,
  autonomousRun,
  userId,
}) => {
  let item = content;
  if (!item && contentId) {
    item = await Content.findById(contentId);
  }
  if (!item) {
    const err = new Error('Content not found');
    err.status = 404;
    throw err;
  }

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    const err = new Error('Invalid scheduledAt');
    err.status = 400;
    throw err;
  }

  item.status = 'scheduled';
  item.scheduledAt = when;
  item.platform = normalizePlatform(platform || item.platform || item.metadata?.suggestedPlatform);
  if (userId && !item.approvedAt) {
    item.approvedBy = userId;
    item.approvedAt = new Date();
  }
  await item.save();

  await PublishJob.updateMany(
    { content: item._id, status: { $in: ['queued', 'processing'] } },
    { $set: { status: 'cancelled' } },
  );

  const job = await PublishJob.create({
    workspace: workspaceId || item.workspace,
    content: item._id,
    platform: item.platform,
    scheduledAt: when,
    predictedBestTime: when,
    status: 'queued',
    autonomousRun: autonomousRun || undefined,
  });

  const { enqueuePublishJob } = require('./publishEnqueue');
  await enqueuePublishJob(job);

  return { content: item, job };
};

const createUploadedDesign = async ({
  workspaceId,
  userId,
  file,
  platform = 'universal',
  title,
  scheduledAt,
  calendarEntryId,
  runId,
  module = 'upload',
  linkPostId,
}) => {
  const imageUrl = toPublicUrl(file.filename);
  const name = title || file.originalname || 'Uploaded Design';

  const design = await Content.create({
    workspace: workspaceId,
    createdBy: userId,
    type: 'image',
    platform,
    title: name,
    content: name,
    mediaUrl: imageUrl,
    thumbnailUrl: imageUrl,
    metadata: {
      module,
      source: 'user-upload',
      filename: file.filename,
      originalName: file.originalname,
      runId: runId ? String(runId) : undefined,
      headline: name,
      name,
      colorPalette: ['#1A2B48', '#4DA8EE', '#FF6B9D'],
      layout: 'uploaded',
    },
    status: scheduledAt ? 'scheduled' : 'draft',
    calendarEntry: calendarEntryId || undefined,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  });

  if (linkPostId) {
    const post = await Content.findById(linkPostId);
    if (post) {
      post.mediaUrl = imageUrl;
      post.thumbnailUrl = imageUrl;
      if (scheduledAt) {
        await scheduleContent({
          content: post,
          platform: post.platform || platform,
          scheduledAt,
          workspaceId,
          autonomousRun: runId,
        });
      } else {
        await post.save();
      }
    }
  } else if (scheduledAt) {
    await scheduleContent({
      content: design,
      platform,
      scheduledAt,
      workspaceId,
      autonomousRun: runId,
    });
  }

  return {
    ...design.toObject(),
    ...(design.metadata?.toObject?.() ?? design.metadata ?? {}),
    _id: design._id,
    mediaUrl: imageUrl,
  };
};

module.exports = { createUploadedDesign, scheduleContent, toPublicUrl };
