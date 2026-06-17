const path = require('path');
const serverless = require('serverless-http');

module.paths.unshift(
  path.join(__dirname, '..', 'server', 'node_modules'),
  path.join(__dirname, 'node_modules'),
);

let handler;
let authHandler;

const requestPath = (req) => {
  const rawUrl = req.url || req.path || '';
  const queryPath = (() => {
    try {
      const url = new URL(rawUrl, 'http://vercel.local');
      return url.searchParams.get('path');
    } catch {
      return null;
    }
  })();

  if (queryPath) {
    if (queryPath === 'health') return '/health';
    return `/api/${queryPath}`;
  }

  const candidates = [
    req.headers['x-vercel-original-path'],
    req.headers['x-invoke-path'],
    req.headers['x-forwarded-uri'],
    rawUrl,
  ].filter(Boolean);

  for (const raw of candidates) {
    const value = String(raw).split('?')[0];
    if (!value || value === '/api') continue;
    return value;
  }

  return '/api';
};

const normalizeRequestUrl = (req) => {
  const pathOnly = requestPath(req);
  if (pathOnly.startsWith('/api/')) {
    req.url = pathOnly;
  } else if (pathOnly === '/health') {
    req.url = '/health';
  }
};

const isAuthRequest = (req) => {
  const pathOnly = requestPath(req);
  if (pathOnly.startsWith('/api/auth') || pathOnly.startsWith('/auth')) return true;
  // Vercel rewrites /api/* to /api — treat POST /api as auth when body looks like login/register
  if (pathOnly === '/api' && req.method === 'POST') return true;
  return false;
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
  normalizeRequestUrl(req);
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

  if (isAuthRequest(req)) {
    try {
      return await handleAuth(req, res);
    } catch (err) {
      console.error('[api] auth failed:', err);
      return sendJson(res, 503, { status: 'error', error: err.message });
    }
  }

  try {
    normalizeRequestUrl(req);
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
