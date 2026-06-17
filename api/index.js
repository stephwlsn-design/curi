const path = require('path');
const serverless = require('serverless-http');

// Resolve server dependencies from api/node_modules (Vercel) or server/node_modules (local)
module.paths.unshift(
  path.join(__dirname, 'node_modules'),
  path.join(__dirname, '..', 'server', 'node_modules'),
);

let handler;

module.exports = async (req, res) => {
  try {
    if (!handler) {
      const { getApp } = require('../server/src/app');
      const app = await getApp();
      handler = serverless(app, { binary: ['image/*', 'multipart/form-data'] });
    }
    return handler(req, res);
  } catch (err) {
    console.error('[api] bootstrap failed:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'error', error: err.message }));
  }
};
