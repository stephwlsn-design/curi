const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { connectDB } = require('../config/database');
const SiteAccessConfig = require('../models/SiteAccessConfig');

const TOKEN_TYPE = 'site_access';
const CONFIG_KEY = 'default';
const CACHE_MS = 30_000;

let cached = null;
let cacheAt = 0;

/** Read env vars; strip wrapping quotes (needed when values contain # or spaces). */
const readEnv = (name) => {
  let value = process.env[name]?.trim() || '';
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
};

/** Supports SITE_ACCESS=username:code or separate SITE_ACCESS_USERNAME / SITE_ACCESS_CODE. */
const readEnvCredentials = () => {
  const combined = readEnv('SITE_ACCESS');
  if (combined.includes(':')) {
    const idx = combined.indexOf(':');
    return {
      username: combined.slice(0, idx).trim(),
      accessCode: combined.slice(idx + 1).trim(),
      source: 'env-combined',
    };
  }

  const username = readEnv('SITE_ACCESS_USERNAME');
  const accessCode = readEnv('SITE_ACCESS_CODE');
  if (username && accessCode) {
    return { username, accessCode, source: 'env-split' };
  }

  return null;
};

const invalidateCache = () => {
  cached = null;
  cacheAt = 0;
};

const loadFromDb = async () => {
  await connectDB();
  const doc = await SiteAccessConfig.findOne({ key: CONFIG_KEY, enabled: true }).lean();
  if (!doc?.username || !doc?.accessCode) return null;
  return {
    username: doc.username,
    accessCode: doc.accessCode,
    source: 'database',
  };
};

const persistToDb = async (credentials) => {
  await connectDB();
  await SiteAccessConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      key: CONFIG_KEY,
      username: credentials.username,
      accessCode: credentials.accessCode,
      enabled: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  invalidateCache();
};

/** Env credentials are synced to MongoDB so the gate survives Vercel env issues after first sync. */
const syncEnvToDb = async () => {
  const envCreds = readEnvCredentials();
  if (!envCreds) return null;
  await persistToDb(envCreds);
  return envCreds;
};

const getGateCredentials = async () => {
  const now = Date.now();
  if (cached && now - cacheAt < CACHE_MS) return cached;

  const envCreds = readEnvCredentials();
  if (envCreds) {
    cached = envCreds;
    cacheAt = now;
    persistToDb(envCreds).catch(() => {});
    return envCreds;
  }

  const dbCreds = await loadFromDb();
  if (dbCreds) {
    cached = dbCreds;
    cacheAt = now;
    return dbCreds;
  }

  cached = null;
  cacheAt = now;
  return null;
};

const isGateEnabled = async () => {
  const creds = await getGateCredentials();
  return Boolean(creds?.username && creds?.accessCode);
};

const safeEqual = (a, b) => {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (!left || !right) return false;
  const ba = Buffer.from(left);
  const bb = Buffer.from(right);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

const verifyCredentials = async (username, code) => {
  const creds = await getGateCredentials();
  if (!creds) return false;
  return safeEqual(username, creds.username) && safeEqual(code, creds.accessCode);
};

const signAccessToken = () => jwt.sign(
  { type: TOKEN_TYPE },
  process.env.JWT_SECRET,
  { expiresIn: '30d' },
);

const verifyAccessToken = (token) => {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.type === TOKEN_TYPE;
  } catch {
    return false;
  }
};

/** One-time bootstrap when env vars are unavailable — requires JWT_SECRET in body. */
const bootstrapGate = async ({ username, code, secret }) => {
  const existing = await loadFromDb();
  if (existing) {
    const err = new Error('Site access is already configured');
    err.status = 409;
    throw err;
  }

  const expected = readEnv('JWT_SECRET');
  if (!expected || !secret || !safeEqual(secret, expected)) {
    const err = new Error('Invalid bootstrap secret');
    err.status = 403;
    throw err;
  }

  if (!username?.trim() || !code?.trim()) {
    const err = new Error('Username and access code are required');
    err.status = 400;
    throw err;
  }

  const creds = { username: username.trim(), accessCode: code.trim(), source: 'bootstrap' };
  await persistToDb(creds);
  cached = creds;
  cacheAt = Date.now();
  return creds;
};

module.exports = {
  TOKEN_TYPE,
  readEnvCredentials,
  getGateCredentials,
  isGateEnabled,
  verifyCredentials,
  signAccessToken,
  verifyAccessToken,
  bootstrapGate,
  persistToDb,
};
