const mongoose = require('mongoose');
const logger = require('../utils/logger');

const globalCache = global;

const normalizeMongoUri = (value) => {
  if (!value) return '';
  let uri = value.trim();
  if (
    (uri.startsWith('"') && uri.endsWith('"'))
    || (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
};

const connectDB = async () => {
  const raw = normalizeMongoUri(process.env.MONGODB_URI);
  const uri = raw || 'mongodb://localhost:27017/curi';

  if (process.env.VERCEL && !raw) {
    throw new Error('MONGODB_URI environment variable is required on Vercel');
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error(
      'MONGODB_URI must start with mongodb:// or mongodb+srv://. '
      + 'Set a MongoDB Atlas connection string in Vercel → Settings → Environment Variables.',
    );
  }

  if (globalCache.mongoose?.conn) return globalCache.mongoose.conn;

  if (!globalCache.mongoose) {
    globalCache.mongoose = { conn: null, promise: null };
  }

  if (!globalCache.mongoose.promise) {
    globalCache.mongoose.promise = mongoose.connect(uri, {
      autoIndex: !process.env.VERCEL,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
      .then((conn) => {
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((err) => {
        globalCache.mongoose.promise = null;
        logger.error('MongoDB connection error:', err);
        if (err.message?.includes('authentication failed')) {
          throw new Error(
            'MongoDB authentication failed. Check the username and password in MONGODB_URI '
            + '(URL-encode special characters in the password).',
          );
        }
        if (err.name === 'MongoServerSelectionError') {
          throw new Error(
            'Could not reach MongoDB Atlas. Confirm the cluster is running (not paused), '
            + 'Network Access allows 0.0.0.0/0, and MONGODB_URI is correct.',
          );
        }
        if (!process.env.VERCEL) process.exit(1);
        throw err;
      });
  }

  globalCache.mongoose.conn = await globalCache.mongoose.promise;
  return globalCache.mongoose.conn;
};

module.exports = { connectDB };
