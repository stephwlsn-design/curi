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

// Routes
const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspace');
const discoverRoutes = require('./routes/discover');
const createRoutes = require('./routes/create');
const designRoutes = require('./routes/design');
const videoRoutes = require('./routes/video');
const mailRoutes = require('./routes/mail');
const launchRoutes = require('./routes/launch');
const calendarRoutes = require('./routes/calendar');
const repurposeRoutes = require('./routes/repurpose');
const trendsRoutes = require('./routes/trends');
const competitorRoutes = require('./routes/competitor');
const publishRoutes = require('./routes/publish');
const analyticsRoutes = require('./routes/analytics');
const billingRoutes = require('./routes/billing');
const autonomousRoutes = require('./routes/autonomous');
const approvalRoutes = require('./routes/approvals');
const { startWorkers } = require('./workers');

const { UPLOAD_DIR, USER_DESIGN_DIR } = require('./middleware/upload');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const { seedTestUser } = require('./utils/seedTestUser');
const discoverService = require('./services/discoverService');
const AutonomousRun = require('./models/AutonomousRun');

const failStaleAutonomousRuns = async () => {
  const cutoff = new Date(Date.now() - 20 * 60 * 1000);
  const result = await AutonomousRun.updateMany(
    { status: { $in: ['running', 'queued'] }, updatedAt: { $lt: cutoff } },
    { $set: { status: 'failed', error: 'Pipeline timed out — please start a new run' } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`Marked ${result.modifiedCount} stale autonomous run(s) as failed`);
  }
};

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/uploads/design-ideas', express.static(UPLOAD_DIR));
app.use('/api/uploads/user-designs', express.static(USER_DESIGN_DIR));

// Global rate limit
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests' }));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date() }));

// Public routes
app.use('/api/auth', authRoutes);
app.post('/api/discover/roast', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const roast = await discoverService.roastWebsite(url);
  res.json({ roast });
});

// Protected routes
app.use('/api/workspace', authenticate, workspaceRoutes);
app.use('/api/discover', authenticate, discoverRoutes);
app.use('/api/create', authenticate, createRoutes);
app.use('/api/design', authenticate, designRoutes);
app.use('/api/video', authenticate, videoRoutes);
app.use('/api/mail', authenticate, mailRoutes);
app.use('/api/launch', authenticate, launchRoutes);
app.use('/api/calendar', authenticate, calendarRoutes);
app.use('/api/repurpose', authenticate, repurposeRoutes);
app.use('/api/trends', authenticate, trendsRoutes);
app.use('/api/competitor', authenticate, competitorRoutes);
app.use('/api/publish', authenticate, publishRoutes);
app.use('/api/analytics', authenticate, analyticsRoutes);
app.use('/api/billing', authenticate, billingRoutes);
app.use('/api/autonomous', authenticate, autonomousRoutes);
app.use('/api/approvals', authenticate, approvalRoutes);
app.use('/api/drafts', authenticate, require('./routes/drafts'));
app.use('/api/scheduled', authenticate, require('./routes/scheduled'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await connectRedis();
  if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_USER === 'true') {
    await seedTestUser();
  }
  await failStaleAutonomousRuns();
  startWorkers();
  app.listen(PORT, () => logger.info(`🐶 Curi server running on port ${PORT}`));
}

start().catch(err => { logger.error(err); process.exit(1); });

module.exports = app;
