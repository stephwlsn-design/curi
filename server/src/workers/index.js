const { getQueue, QUEUE_NAMES, addJob } = require('../config/queue');
const { runAutonomousPipeline } = require('../services/autonomousEngineService');
const { discoverTopics } = require('../services/topicDiscoveryService');
const { generateCampaign, advanceLaunchCampaign } = require('../services/launchService');
const { processPublishJob, processDuePublishJobs } = require('../services/publishJobRunner');
const PublishJob = require('../models/PublishJob');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

const startWorkers = () => {
  const autonomousQueue = getQueue(QUEUE_NAMES.AUTONOMOUS);
  const topicQueue = getQueue(QUEUE_NAMES.TOPIC_DISCOVERY);
  const publishQueue = getQueue(QUEUE_NAMES.PUBLISH);
  const launchQueue = getQueue(QUEUE_NAMES.LAUNCH);

  if (launchQueue) {
    launchQueue.process(async (job) => {
      logger.info(`Processing launch campaign job ${job.id}`);
      await generateCampaign(job.data);
    });
  }

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

  const pollDuePublishJobs = async () => {
    if (publishQueue) {
      const due = await PublishJob.find({
        status: 'queued',
        scheduledAt: { $lte: new Date() },
      }).limit(20);

      for (const job of due) {
        await addJob(QUEUE_NAMES.PUBLISH, { publishJobId: job._id.toString() }, { jobId: job._id.toString() });
      }
      return;
    }

    await processDuePublishJobs();
  };

  if (publishQueue) {
    publishQueue.process(async (job) => {
      await processPublishJob(job.data.publishJobId);
    });
  }

  setInterval(() => {
    pollDuePublishJobs().catch((err) => logger.error(`Publish poll failed: ${err.message}`));
  }, 60_000);

  pollDuePublishJobs().catch(() => {});

  logger.info(`Queue workers started${publishQueue ? '' : ' (publish: in-process fallback)'}`);
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

const enqueueLaunchCampaign = async (payload) => {
  const run = () => advanceLaunchCampaign({
    campaignId: payload.campaignId,
    userId: payload.userId,
    maxSteps: Infinity,
    maxMs: process.env.VERCEL ? 50_000 : 120_000,
  }).catch((err) => {
    logger.error(`Launch generation failed: ${err.message}`);
  });

  // Always run in-process — launch must not depend on a separate worker consuming Redis.
  if (typeof setImmediate === 'function') {
    setImmediate(run);
  } else {
    run();
  }
};

module.exports = { startWorkers, enqueueAutonomousRun, enqueueTopicDiscovery, enqueueLaunchCampaign };
