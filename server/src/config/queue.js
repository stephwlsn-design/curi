const Bull = require('bull');
const { getRedis } = require('./redis');
const logger = require('../utils/logger');

const QUEUE_NAMES = {
  AUTONOMOUS: 'autonomous-pipeline',
  TOPIC_DISCOVERY: 'topic-discovery',
  PUBLISH: 'publish-jobs',
};

const queues = {};

const getQueue = (name) => {
  if (queues[name]) return queues[name];

  const redis = getRedis();
  const opts = redis
    ? { redis: { host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379', 10) } }
    : undefined;

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
