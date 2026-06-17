require('express-async-errors');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');

const failStaleAutonomousRuns = async () => {
  const AutonomousRun = require('./models/AutonomousRun');
  const cutoff = new Date(Date.now() - 20 * 60 * 1000);
  const result = await AutonomousRun.updateMany(
    { status: { $in: ['running', 'queued'] }, updatedAt: { $lt: cutoff } },
    { $set: { status: 'failed', error: 'Pipeline timed out — please start a new run' } },
  );
  if (result.modifiedCount > 0) {
    logger.info(`Marked ${result.modifiedCount} stale autonomous run(s) as failed`);
  }
};

const buildAllowedOrigins = () => {
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  return [...new Set(origins)];
};

const mountRoutes = (app) => {
  const { authenticate } = require('./middleware/auth');
  const { errorHandler } = require('./middleware/errorHandler');
  const discoverService = require('./services/discoverService');

  app.use('/api/auth', require('./routes/auth'));
  app.post('/api/discover/roast', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const roast = await discoverService.roastWebsite(url);
    res.json({ roast });
  });

  app.use('/api/workspace', authenticate, require('./routes/workspace'));
  app.use('/api/discover', authenticate, require('./routes/discover'));
  app.use('/api/create', authenticate, require('./routes/create'));
  app.use('/api/design', authenticate, require('./routes/design'));
  app.use('/api/video', authenticate, require('./routes/video'));
  app.use('/api/mail', authenticate, require('./routes/mail'));
  app.use('/api/launch', authenticate, require('./routes/launch'));
  app.use('/api/calendar', authenticate, require('./routes/calendar'));
  app.use('/api/repurpose', authenticate, require('./routes/repurpose'));
  app.use('/api/trends', authenticate, require('./routes/trends'));
  app.use('/api/competitor', authenticate, require('./routes/competitor'));
  app.use('/api/publish', authenticate, require('./routes/publish'));
  app.use('/api/analytics', authenticate, require('./routes/analytics'));
  app.use('/api/billing', authenticate, require('./routes/billing'));
  app.use('/api/autonomous', authenticate, require('./routes/autonomous'));
  app.use('/api/approvals', authenticate, require('./routes/approvals'));
  app.use('/api/drafts', authenticate, require('./routes/drafts'));
  app.use('/api/scheduled', authenticate, require('./routes/scheduled'));

  app.use(errorHandler);
};

const createApp = async () => {
  const conn = await connectDB();
  await connectRedis();

  const shouldSeedDemo = process.env.SEED_DEMO_USER === 'true'
    || (!process.env.VERCEL && process.env.NODE_ENV !== 'production');
  if (shouldSeedDemo) {
    const { seedTestUser } = require('./utils/seedTestUser');
    await seedTestUser();
  }
  if (!process.env.VERCEL) {
    try {
      await failStaleAutonomousRuns();
    } catch (err) {
      logger.warn('Could not check stale autonomous runs:', err.message);
    }
  }

  const { UPLOAD_DIR, USER_DESIGN_DIR } = require('./middleware/upload');

  const app = express();
  const allowedOrigins = buildAllowedOrigins();

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    app.set('trust proxy', 1);
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use('/api/uploads/design-ideas', express.static(UPLOAD_DIR));
  app.use('/api/uploads/user-designs', express.static(USER_DESIGN_DIR));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests' }));

  app.get('/health', (req, res) => res.json({
    status: 'ok',
    version: '1.0.0',
    platform: process.env.VERCEL ? 'vercel' : 'node',
    db: conn.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date(),
  }));

  mountRoutes(app);
  return app;
};

let cachedApp;
const getApp = async () => {
  if (!cachedApp) cachedApp = await createApp();
  return cachedApp;
};

module.exports = { createApp, getApp };
