const mongoose = require('mongoose');
const logger = require('../utils/logger');

const globalCache = global;

const normalizeMongoUri = (value) => {
  if (!value) return '';
  let uri = value.trim();
  // Accidentally pasted "MONGODB_URI=..." into Vercel value field
  uri = uri.replace(/^MONGODB_URI\s*=\s*/i, '');
  if (
    (uri.startsWith('"') && uri.endsWith('"'))
    || (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
};

const resetMongoCache = () => {
  if (globalCache.mongoose) {
    globalCache.mongoose.conn = null;
    globalCache.mongoose.promise = null;
  }
};

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  }),
]);

const connectDB = async () => {
  const raw = normalizeMongoUri(process.env.MONGODB_URI);
  const uri = raw || 'mongodb://localhost:27017/curi';

  if (process.env.VERCEL && !raw) {
    throw new Error('MONGODB_URI environment variable is required on Vercel');
  }

  if (/<\s*password\s*>/i.test(uri)) {
    throw new Error(
      'MONGODB_URI still contains the <password> placeholder. '
      + 'Replace it with your Atlas database user password.',
    );
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error(
      'MONGODB_URI must start with mongodb:// or mongodb+srv://. '
      + 'Set a MongoDB Atlas connection string in Vercel → Settings → Environment Variables.',
    );
  }

  const existing = globalCache.mongoose?.conn;
  if (existing?.connection?.readyState === 1) return existing;
  if (existing) resetMongoCache();

  if (!globalCache.mongoose) {
    globalCache.mongoose = { conn: null, promise: null };
  }

  if (!globalCache.mongoose.promise) {
    globalCache.mongoose.promise = mongoose.connect(uri, {
      autoIndex: !process.env.VERCEL,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      bufferCommands: false,
    })
      .then((conn) => {
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((err) => {
        resetMongoCache();
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

  try {
    globalCache.mongoose.conn = await withTimeout(
      globalCache.mongoose.promise,
      12000,
      'MongoDB connection timed out',
    );
    if (globalCache.mongoose.conn.connection.readyState !== 1) {
      resetMongoCache();
      throw new Error('MongoDB connection did not become ready');
    }
    return globalCache.mongoose.conn;
  } catch (err) {
    resetMongoCache();
    if (err.message === 'MongoDB connection timed out') {
      throw new Error(
        'MongoDB connection timed out. Confirm your Atlas cluster is running (not paused), '
        + 'credentials in MONGODB_URI are correct, and Network Access allows 0.0.0.0/0.',
      );
    }
    throw err;
  }
};

module.exports = { connectDB };
