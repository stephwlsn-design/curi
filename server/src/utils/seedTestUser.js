const User = require('../models/User');
const Workspace = require('../models/Workspace');
const logger = require('./logger');

const TEST_USER = {
  name: 'Demo User',
  email: 'demo@curi.app',
  password: 'Test1234!',
};

const PLAN_CREDITS = { free: 20, starter: 500, pro: 2000, agency: 10000 };

async function seedTestUser() {
  const existing = await User.findOne({ email: TEST_USER.email });
  if (existing) {
    const refill = PLAN_CREDITS[existing.plan] || PLAN_CREDITS.pro;
    if (existing.credits < refill) {
      existing.credits = refill;
      existing.creditsResetAt = new Date();
      await existing.save();
      logger.info(`Test user credits refilled to ${refill}`);
    }
    logger.info('Test user ready — demo@curi.app / Test1234!');
    return;
  }

  const user = await User.create({
    ...TEST_USER,
    plan: 'pro',
    credits: PLAN_CREDITS.pro,
  });

  const workspace = await Workspace.create({
    name: "Demo User's Brand",
    owner: user._id,
  });

  user.currentWorkspace = workspace._id;
  await user.save();

  logger.info('Created test user — demo@curi.app / Test1234!');
}

module.exports = { seedTestUser, TEST_USER };
