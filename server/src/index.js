const { createApp } = require('./app');
const { startWorkers } = require('./workers');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

async function start() {
  const app = await createApp();
  if (!process.env.VERCEL) startWorkers();
  app.listen(PORT, () => logger.info(`🐶 Curi server running on port ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => { logger.error(err); process.exit(1); });
}

module.exports = { start };
