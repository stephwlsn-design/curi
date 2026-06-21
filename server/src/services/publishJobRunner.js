const PublishJob = require('../models/PublishJob');
const Content = require('../models/Content');
const User = require('../models/User');
const publishService = require('./publishService');
const { resolveContentForPublish } = require('./contentPublishResolver');
const { resolveSocialAccount, normalizePlatform } = require('./socialAccountService');
const logger = require('../utils/logger');

const processPublishJob = async (publishJobId) => {
  const publishJob = await PublishJob.findOneAndUpdate(
    { _id: publishJobId, status: { $in: ['queued', 'processing'] } },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { new: true },
  ).populate('content');

  if (!publishJob) return { skipped: true };

  if (!publishJob.content) {
    publishJob.status = 'failed';
    publishJob.error = 'Content not found';
    await publishJob.save();
    return { failed: true, error: publishJob.error };
  }

  const platform = normalizePlatform(publishJob.platform);
  const user = await User.findById(publishJob.content.createdBy);
  const socialAccount = resolveSocialAccount(user, platform);

  if (!socialAccount) {
    publishJob.status = 'failed';
    publishJob.error = `No ${platform} account connected — connect in Settings → Publishing`;
    await publishJob.save();
    await Content.findByIdAndUpdate(publishJob.content._id, {
      status: 'failed',
      publishError: publishJob.error,
    });
    return { failed: true, error: publishJob.error };
  }

  try {
    const publishContent = await resolveContentForPublish(publishJob.content);
    const result = await publishService.publish({
      content: publishContent,
      socialAccount,
      platform,
    });

    publishJob.status = 'published';
    publishJob.publishedAt = new Date();
    publishJob.externalId = result?.platformPostId;
    await publishJob.save();

    await Content.findByIdAndUpdate(publishJob.content._id, {
      status: 'published',
      publishedAt: new Date(),
      publishError: undefined,
      platform,
    });

    logger.info(`Published job ${publishJob._id} to ${platform}`);
    return { published: true, result };
  } catch (err) {
    const message = err.response?.data?.error?.message
      || err.response?.data?.message
      || err.message;

    publishJob.status = publishJob.attempts >= 3 ? 'failed' : 'queued';
    publishJob.error = message;
    await publishJob.save();

    if (publishJob.status === 'failed') {
      await Content.findByIdAndUpdate(publishJob.content._id, {
        status: 'failed',
        publishError: message,
      });
    }

    logger.error(`Publish job ${publishJob._id} failed: ${message}`);
    return { failed: true, error: message, retry: publishJob.status === 'queued' };
  }
};

const processDuePublishJobs = async (limit = 20) => {
  const due = await PublishJob.find({
    status: 'queued',
    scheduledAt: { $lte: new Date() },
  }).sort({ scheduledAt: 1 }).limit(limit);

  const results = [];
  for (const job of due) {
    results.push(await processPublishJob(job._id));
  }
  return results;
};

module.exports = { processPublishJob, processDuePublishJobs };
