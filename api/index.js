const path = require('path');
const serverless = require('serverless-http');

// Resolve server dependencies from api/node_modules (Vercel) or server/node_modules (local)
module.paths.unshift(
  path.join(__dirname, 'node_modules'),
  path.join(__dirname, '..', 'server', 'node_modules'),
);

let handler;
let initError;

module.exports = async (req, res) => {
  if (initError) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'error', error: initError.message }));
  }

  try {
    if (!handler) {
      const { getApp } = require('../server/src/app');
      const app = await getApp();
      handler = serverless(app, { binary: ['image/*', 'multipart/form-data'] });
    }
    return handler(req, res);
  } catch (err) {
    initError = err;
    console.error('[api] bootstrap failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'error', error: err.message }));
  }
};
