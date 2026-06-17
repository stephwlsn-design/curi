const mongoose = require('mongoose');
const logger = require('../utils/logger');

const globalCache = global;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/curi';

  if (process.env.VERCEL && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required on Vercel');
  }

  if (globalCache.mongoose?.conn) return globalCache.mongoose.conn;

  if (!globalCache.mongoose) {
    globalCache.mongoose = { conn: null, promise: null };
  }

  if (!globalCache.mongoose.promise) {
    globalCache.mongoose.promise = mongoose.connect(uri, { autoIndex: !process.env.VERCEL })
      .then((conn) => {
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((err) => {
        globalCache.mongoose.promise = null;
        logger.error('MongoDB connection error:', err);
        if (!process.env.VERCEL) process.exit(1);
        throw err;
      });
  }

  globalCache.mongoose.conn = await globalCache.mongoose.promise;
  return globalCache.mongoose.conn;
};

module.exports = { connectDB };
