const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');

const toPublicUrl = (filename) => `/api/uploads/user-designs/${filename}`;

const scheduleContent = async ({
  content, platform, scheduledAt, workspaceId, autonomousRun,
}) => {
  const when = new Date(scheduledAt);
  content.status = 'scheduled';
  content.scheduledAt = when;
  content.platform = platform || content.platform || 'universal';
  await content.save();

  await PublishJob.create({
    workspace: workspaceId,
    content: content._id,
    platform: content.platform,
    scheduledAt: when,
    predictedBestTime: when,
    status: 'queued',
    autonomousRun: autonomousRun || undefined,
  });

  return content;
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
