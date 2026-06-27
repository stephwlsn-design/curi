const Bull = require('bull');
const { getRedis } = require('./redis');
const logger = require('../utils/logger');

const QUEUE_NAMES = {
  AUTONOMOUS: 'autonomous-pipeline',
  TOPIC_DISCOVERY: 'topic-discovery',
  PUBLISH: 'publish-jobs',
  LAUNCH: 'launch-campaign',
};

const queues = {};

const buildRedisOpts = () => {
  const url = process.env.REDIS_URL?.trim();
  if (url) return { redis: url };
  const redis = getRedis();
  if (!redis) return null;
  return {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  };
};

const getQueue = (name) => {
  if (queues[name]) return queues[name];

  const opts = buildRedisOpts();
  if (!opts) {
    logger.warn(`Queue ${name}: Redis unavailable, jobs will run in-process`);
    return null;
  }

  const queueOpts = { ...opts };
  if (name === QUEUE_NAMES.AUTONOMOUS) {
    queueOpts.settings = {
      lockDuration: 900000,
      stalledInterval: 300000,
      maxStalledCount: 1,
    };
  }
  if (name === QUEUE_NAMES.LAUNCH) {
    queueOpts.settings = {
      lockDuration: 600000,
      stalledInterval: 120000,
      maxStalledCount: 2,
    };
  }

  queues[name] = new Bull(name, queueOpts);
  queues[name].on('failed', (job, err) => logger.error(`Queue ${name} job ${job?.id} failed: ${err.message}`));
  return queues[name];
};

const addJob = async (name, data, opts = {}) => {
  const queue = getQueue(name);
  if (queue) return queue.add(data, { attempts: 3, backoff: 5000, removeOnComplete: true, ...opts });
  return null;
};

module.exports = { QUEUE_NAMES, getQueue, addJob };
