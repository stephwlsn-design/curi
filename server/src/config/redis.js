const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const connectRedis = async () => {
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
