const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const connectRedis = async () => {
  if (process.env.VERCEL && !process.env.REDIS_URL) {
    logger.info('Redis skipped on Vercel (no REDIS_URL)');
    return;
  }
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { lazyConnect: true });
    await redis.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis not available, using in-memory fallback');
  }
};

const getRedis = () => redis;
module.exports = { connectRedis, getRedis };
