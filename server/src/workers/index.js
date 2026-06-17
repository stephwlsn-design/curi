const { getQueue, QUEUE_NAMES, addJob } = require('../config/queue');
const { runAutonomousPipeline } = require('../services/autonomousEngineService');
const { discoverTopics } = require('../services/topicDiscoveryService');
const publishService = require('../services/publishService');
const PublishJob = require('../models/PublishJob');
const Content = require('../models/Content');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

const startWorkers = () => {
  const autonomousQueue = getQueue(QUEUE_NAMES.AUTONOMOUS);
  const topicQueue = getQueue(QUEUE_NAMES.TOPIC_DISCOVERY);
  const publishQueue = getQueue(QUEUE_NAMES.PUBLISH);

  if (autonomousQueue) {
    autonomousQueue.process(async (job) => {
      logger.info(`Processing autonomous pipeline job ${job.id}`);
      await runAutonomousPipeline({ runId: job.data.runId });
    });
  }

  if (topicQueue) {
    topicQueue.process(async (job) => {
      const { workspaceId } = job.data;
      if (workspaceId) {
        const workspace = await Workspace.findById(workspaceId);
        if (workspace) await discoverTopics({ workspaceId, brandProfile: workspace.brandProfile });
        return;
      }
      const workspaces = await Workspace.find({ 'onboarding.complete': true }).select('_id brandProfile');
      for (const ws of workspaces) {
        await discoverTopics({ workspaceId: ws._id, brandProfile: ws.brandProfile });
      }
    });

    topicQueue.add({ daily: true }, { repeat: { cron: '0 4 * * *' } }).catch(() => {});
  }

  if (publishQueue) {
    publishQueue.process(async (job) => {
      const publishJob = await PublishJob.findOneAndUpdate(
        { _id: job.data.publishJobId, status: { $in: ['queued', 'processing'] } },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { new: true }
      ).populate('content');

      if (!publishJob) return;
      if (!publishJob.content) {
        publishJob.status = 'failed';
        publishJob.error = 'Content not found';
        await publishJob.save();
        return;
      }

      try {
        const user = await User.findById(publishJob.content.createdBy);
        const socialAccount = user?.socialAccounts?.find(a => a.platform === publishJob.platform);

        if (!socialAccount) {
          publishJob.status = 'failed';
          publishJob.error = `No ${publishJob.platform} account connected`;
          await publishJob.save();
          return;
        }

        const result = await publishService.publish({
          content: publishJob.content,
          socialAccount,
          platform: publishJob.platform,
        });

        publishJob.status = 'published';
        publishJob.publishedAt = new Date();
        publishJob.externalId = result?.id || result?.postId || result?.platformPostId;
        await publishJob.save();

        await Content.findByIdAndUpdate(publishJob.content._id, {
          status: 'published',
          publishedAt: new Date(),
        });
      } catch (err) {
        publishJob.status = publishJob.attempts >= 3 ? 'failed' : 'queued';
        publishJob.error = err.message;
        await publishJob.save();
        if (publishJob.attempts < 3) throw err;
      }
    });

    setInterval(async () => {
      const due = await PublishJob.find({
        status: 'queued',
        scheduledAt: { $lte: new Date() },
      }).limit(20);

      for (const job of due) {
        await addJob(QUEUE_NAMES.PUBLISH, { publishJobId: job._id.toString() }, { jobId: job._id.toString() });
      }
    }, 60_000);
  }

  logger.info('Queue workers started');
};

const enqueueAutonomousRun = async (runId) => {
  if (process.env.VERCEL) {
    return;
  }
  const queued = await addJob(QUEUE_NAMES.AUTONOMOUS, { runId: runId.toString() });
  if (!queued) {
    runAutonomousPipeline({ runId }).catch(err => logger.error(`In-process pipeline failed: ${err.message}`));
  }
};

const enqueueTopicDiscovery = async (workspaceId) => {
  const queued = await addJob(QUEUE_NAMES.TOPIC_DISCOVERY, { workspaceId: workspaceId.toString() });
  if (!queued) {
    const workspace = await Workspace.findById(workspaceId);
    if (workspace) discoverTopics({ workspaceId, brandProfile: workspace.brandProfile }).catch(() => {});
  }
};

module.exports = { startWorkers, enqueueAutonomousRun, enqueueTopicDiscovery };
