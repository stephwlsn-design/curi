const { getQueue, QUEUE_NAMES, addJob } = require('../config/queue');
const { processPublishJob } = require('./publishJobRunner');
const logger = require('../utils/logger');

const enqueuePublishJob = async (job) => {
  const delay = Math.max(0, new Date(job.scheduledAt).getTime() - Date.now());
  const queued = await addJob(
    QUEUE_NAMES.PUBLISH,
    { publishJobId: job._id.toString() },
    { jobId: job._id.toString(), delay },
  );

  if (!queued && delay === 0) {
    setImmediate(() => {
      processPublishJob(job._id).catch((err) => {
        logger.error(`In-process publish failed for job ${job._id}: ${err.message}`);
      });
    });
  }
};

module.exports = { enqueuePublishJob };
