const { addJob, QUEUE_NAMES } = require('../config/queue');
const { deployGrowCampaign } = require('./growCampaignWorker');
const logger = require('../utils/logger');

const enqueueGrowCampaign = async (campaignId) => {
  const id = String(campaignId);
  const queued = await addJob(QUEUE_NAMES.GROW_CAMPAIGN, { campaignId: id });
  if (!queued) {
    deployGrowCampaign(id).catch((err) => logger.error(`Grow+ in-process deploy failed: ${err.message}`));
  }
};

module.exports = { enqueueGrowCampaign };
