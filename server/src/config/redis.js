const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  }),
]);

const connectRedis = async () => {
  if (process.env.VERCEL && !process.env.REDIS_URL?.trim()) {
    logger.info('Redis skipped on Vercel (no REDIS_URL)');
    return;
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) return;

  try {
    redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 4000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    await withTimeout(redis.connect(), 5000, 'Redis connection timed out');
    logger.info('Redis connected');
  } catch (err) {
    redis = null;
    logger.warn(`Redis not available (${err.message}), using in-memory fallback`);
  }
};

const getRedis = () => redis;
module.exports = { connectRedis, getRedis };
