const path = require('path');
const serverless = require('serverless-http');

module.paths.unshift(
  path.join(__dirname, '..', 'server', 'node_modules'),
  path.join(__dirname, 'node_modules'),
);

let handler;
let authHandler;

const requestPath = (req) => {
  const raw = req.url || req.path || '';
  return raw.split('?')[0] || '/';
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const handleHealth = async (res) => {
  const { connectDB } = require('../server/src/config/database');
  const conn = await connectDB();
  sendJson(res, 200, {
    status: 'ok',
    version: '1.0.0',
    platform: process.env.VERCEL ? 'vercel' : 'node',
    db: conn.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
};

const ensureDemoUser = async () => {
  if (process.env.SEED_DEMO_USER !== 'true') return;
  const { seedTestUser } = require('../server/src/utils/seedTestUser');
  await seedTestUser();
};

const handleAuth = async (req, res) => {
  const { connectDB } = require('../server/src/config/database');
  await connectDB();
  await ensureDemoUser();

  if (!authHandler) {
    const express = require('express');
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/auth', require('../server/src/routes/auth'));
    authHandler = serverless(app);
  }

  return authHandler(req, res);
};

module.exports = async (req, res) => {
  const pathOnly = requestPath(req);

  if (pathOnly === '/health' || pathOnly === '/api/health') {
    try {
      return await handleHealth(res);
    } catch (err) {
      console.error('[api] health failed:', err);
      return sendJson(res, 503, { status: 'error', error: err.message });
    }
  }

  if (pathOnly.startsWith('/api/auth') || pathOnly.startsWith('/auth')) {
    try {
      return await handleAuth(req, res);
    } catch (err) {
      console.error('[api] auth failed:', err);
      return sendJson(res, 503, { status: 'error', error: err.message });
    }
  }

  try {
    if (!handler) {
      const { getApp } = require('../server/src/app');
      const app = await getApp();
      handler = serverless(app, { binary: ['image/*', 'multipart/form-data'] });
    }
    return handler(req, res);
  } catch (err) {
    console.error('[api] bootstrap failed:', err);
    return sendJson(res, 503, { status: 'error', error: err.message });
  }
};
