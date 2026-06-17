const path = require('path');
const serverless = require('serverless-http');

module.paths.unshift(
  path.join(__dirname, 'node_modules'),
  path.join(__dirname, '..', 'server', 'node_modules'),
);

let handler;

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
  const mongoose = require('mongoose');
  const { connectDB } = require('../server/src/config/database');
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected after connectDB()');
  }
  sendJson(res, 200, {
    status: 'ok',
    version: '1.0.0',
    platform: process.env.VERCEL ? 'vercel' : 'node',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
};

module.exports = async (req, res) => {
  const pathOnly = requestPath(req);

  if (pathOnly === '/health') {
    try {
      return await handleHealth(res);
    } catch (err) {
      console.error('[api] health failed:', err);
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
