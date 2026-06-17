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

const getQueryParams = (req) => {
  const rawUrl = req.url || req.path || '';
  try {
    const url = new URL(rawUrl, 'http://vercel.local');
    return Object.fromEntries(url.searchParams);
  } catch {
    return {};
  }
};

const isDesignMediaRequest = (req) => {
  const pathOnly = requestPath(req);
  return req.method === 'GET' && (
    pathOnly.startsWith('/api/design/media/photos')
    || pathOnly.startsWith('/api/design/media/videos')
  );
};

const isDesignFastRequest = (req) => {
  const pathOnly = requestPath(req);
  if (pathOnly === '/api/design/save' && req.method === 'POST') return true;
  if (pathOnly === '/api/design/library' && req.method === 'GET') return true;
  if (pathOnly === '/api/design/templates' && req.method === 'GET') return true;
  if (pathOnly === '/api/design/character/speak' && req.method === 'POST') return true;
  if (req.method === 'PATCH' && /^\/api\/design\/[^/]+$/.test(pathOnly)) return true;
  return false;
};

const isDesignIdeaRequest = (req) => {
  const pathOnly = requestPath(req);
  return req.method === 'POST' && pathOnly === '/api/design/idea';
};

const isDiscoverRequest = (req) => {
  const pathOnly = requestPath(req);
  return req.method === 'POST' && (pathOnly === '/api/discover' || pathOnly === '/discover');
};

const DISCOVER_VOICES = ['professional', 'casual', 'witty', 'bold', 'authoritative', 'friendly'];

const sanitizeDiscoverProfile = (profile, url) => {
  const clean = { ...profile };
  delete clean._source;
  delete clean._aiNote;
  if (clean.voice && !DISCOVER_VOICES.includes(clean.voice)) {
    clean.voice = DISCOVER_VOICES.find((v) => v === clean.voice?.toLowerCase()) || 'professional';
  }
  clean.url = url;
  clean.lastDiscoveredAt = new Date();
  return clean;
};

const handleDiscover = async (req, res) => {
  const { connectDB } = require('../server/src/config/database');
  const discoverService = require('../server/src/services/discoverService');
  const { findAccessibleWorkspace } = require('../server/src/utils/workspaceAccess');
  const { mergeBrandProfile } = require('../server/src/utils/brandProfile');
  const User = require('../server/src/models/User');

  await connectDB();
  let user = await authenticateRequest(req);
  const body = req.body || {};
  let { url, workspaceId } = body;

  if (!url?.trim()) return sendJson(res, 400, { error: 'URL is required' });
  if (!workspaceId) {
    return sendJson(res, 400, { error: 'Workspace not loaded. Sign out and sign in again.' });
  }

  const creditCost = 5;
  user = await User.findById(user._id);
  if (!user) return sendJson(res, 401, { error: 'User not found' });
  if (user.credits < creditCost) {
    return sendJson(res, 402, {
      error: 'Insufficient credits',
      required: creditCost,
      available: user.credits,
    });
  }

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    return sendJson(res, 404, { error: 'Workspace not found. Sign out and sign in again.' });
  }

  try {
    const result = await discoverService.analyzeWebsite(url);
    const { _source, _aiNote, ...brandData } = result;
    const brandProfile = sanitizeDiscoverProfile(brandData, url);

    workspace.brandProfile = mergeBrandProfile(workspace.brandProfile, brandProfile);
    await workspace.save();
    await user.deductCredits(creditCost);

    return sendJson(res, 200, {
      brandProfile: workspace.brandProfile,
      source: _source || 'ai',
      note: _aiNote || null,
    });
  } catch (err) {
    console.error('[api] discover failed:', err);
    const message = discoverService.friendlyAIError(err) || err.message || 'Analysis failed';
    return sendJson(res, 502, { error: message });
  }
};

const isCreateFastRequest = (req) => {
  const pathOnly = requestPath(req);
  if (pathOnly === '/api/create/post' && req.method === 'POST') return true;
  if (req.method === 'PATCH' && /^\/api\/create\/[^/]+$/.test(pathOnly)) return true;
  return false;
};

const formatCreateError = (err) => {
  const msg = err.message || '';
  if (msg.includes('timed out')) return 'Generation timed out — try again';
  if (msg.includes('quota') || err.status === 429) {
    return 'AI quota exceeded — check your Gemini or OpenAI billing';
  }
  if (msg.includes('GEMINI') || msg.includes('API key')) {
    return 'AI API key error — check GEMINI_API_KEY in Vercel environment variables';
  }
  return msg || 'Content generation failed';
};

const handleCreateFast = async (req, res) => {
  const { connectDB } = require('../server/src/config/database');
  const createService = require('../server/src/services/createService');
  const Content = require('../server/src/models/Content');
  const { findAccessibleWorkspace } = require('../server/src/utils/workspaceAccess');
  const User = require('../server/src/models/User');

  await connectDB();
  const user = await authenticateRequest(req);
  const pathOnly = requestPath(req);
  const body = req.body || {};

  if (pathOnly === '/api/create/post' && req.method === 'POST') {
    const { workspaceId, platform, topic, tone, type } = body;
    if (!topic?.trim()) return sendJson(res, 400, { error: 'Topic is required' });
    if (!workspaceId) {
      return sendJson(res, 400, { error: 'Workspace not loaded. Sign out and sign in again.' });
    }

    const creditCost = 1;
    const userWithCredits = await User.findById(user._id);
    if (!userWithCredits) return sendJson(res, 401, { error: 'User not found' });
    if (userWithCredits.credits < creditCost) {
      return sendJson(res, 402, {
        error: 'Insufficient credits',
        required: creditCost,
        available: userWithCredits.credits,
      });
    }

    const workspace = await findAccessibleWorkspace(workspaceId, userWithCredits._id);
    if (!workspace) return sendJson(res, 404, { error: 'Workspace not found' });

    try {
      const generated = await createService.generatePost({
        brandProfile: workspace.brandProfile,
        platform,
        topic,
        tone: tone || workspace.brandProfile?.voice || 'professional',
        type: type || 'social_post',
      });

      const content = await Content.create({
        workspace: workspaceId,
        createdBy: userWithCredits._id,
        type: 'post',
        platform,
        content: generated.content,
        hashtags: generated.hashtags,
        emojis: generated.emojis,
        metadata: { topic, tone, characterCount: generated.content.length },
      });

      workspace.stats.postsGenerated = (workspace.stats.postsGenerated || 0) + 1;
      await workspace.save();
      await userWithCredits.deductCredits(creditCost);

      return sendJson(res, 201, { content });
    } catch (err) {
      console.error('[api] create/post failed:', err);
      return sendJson(res, 502, { error: formatCreateError(err) });
    }
  }

  if (req.method === 'PATCH') {
    const contentId = pathOnly.replace('/api/create/', '');
    const { content, status, hashtags, workspaceId } = body;
    const update = {};
    if (content !== undefined) update.content = content;
    if (status !== undefined) update.status = status;
    if (hashtags !== undefined) update.hashtags = hashtags;

    const updated = await Content.findOneAndUpdate(
      { _id: contentId, workspace: workspaceId, createdBy: user._id },
      update,
      { new: true },
    );
    if (!updated) return sendJson(res, 404, { error: 'Content not found' });
    return sendJson(res, 200, { content: updated });
  }

  return sendJson(res, 404, { error: 'Not found' });
};

const handleDesignFast = async (req, res) => {
  const { connectDB } = require('../server/src/config/database');
  const {
    saveDesignDraft, patchDesign, listDesignLibrary,
  } = require('../server/src/services/designSaveService');
  const DesignTemplate = require('../server/src/models/DesignTemplate');
  const { findAccessibleWorkspace } = require('../server/src/utils/workspaceAccess');

  await connectDB();
  const user = await authenticateRequest(req);
  const pathOnly = requestPath(req);
  const q = getQueryParams(req);
  const body = req.body || {};

  if (pathOnly === '/api/design/library' && req.method === 'GET') {
    const designs = await listDesignLibrary(q.workspaceId);
    return sendJson(res, 200, { designs });
  }

  if (pathOnly === '/api/design/templates' && req.method === 'GET') {
    const workspace = await findAccessibleWorkspace(q.workspaceId, user._id);
    if (!workspace) return sendJson(res, 404, { error: 'Workspace not found' });
    const userTemplates = await DesignTemplate.find({ workspace: q.workspaceId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return sendJson(res, 200, { templates: userTemplates });
  }

  if (pathOnly === '/api/design/save' && req.method === 'POST') {
    const design = await saveDesignDraft({ user, workspaceId: body.workspaceId, body });
    return sendJson(res, 201, { design });
  }

  if (pathOnly === '/api/design/character/speak' && req.method === 'POST') {
    try {
      const talkingCharacterService = require('../server/src/services/talkingCharacterService');
      const User = require('../server/src/models/User');
      const userWithCredits = await User.findById(user._id);
      const result = await talkingCharacterService.synthesizeSpeech({
        text: body.text,
        language: body.language || 'en',
        tonality: body.tonality || 'friendly',
      });
      if (userWithCredits?.credits > 0) {
        await userWithCredits.deductCredits(1);
      }
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, err.status || 503, {
        error: err.message,
        hint: err.hint,
        code: err.code,
      });
    }
  }

  if (req.method === 'PATCH') {
    const designId = pathOnly.replace('/api/design/', '');
    const design = await patchDesign({ user, designId, body });
    return sendJson(res, 200, { design });
  }

  return sendJson(res, 404, { error: 'Not found' });
};

const readRequestBuffer = async (req) => {
  if (typeof req[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
};

const parseMultipartForm = async (req) => {
  const Busboy = require('busboy');
  const buffer = await withTimeout(readRequestBuffer(req), 15000, 'Upload read timed out');
  if (!buffer.length) return { fields: {}, file: null, fileMeta: null };

  return new Promise((resolve, reject) => {
    const fields = {};
    let fileBuffer = null;
    let fileMeta = null;
    const busboy = Busboy({ headers: req.headers });

    busboy.on('file', (fieldname, file, info) => {
      if (fieldname !== 'image') {
        file.resume();
        return;
      }
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        fileMeta = { ...info, fieldname };
      });
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('finish', () => resolve({ fields, file: fileBuffer, fileMeta }));
    busboy.on('error', reject);
    busboy.end(buffer);
  });
};

const handleDesignIdea = async (req, res) => {
  const fs = require('fs');
  const pathMod = require('path');
  const { connectDB } = require('../server/src/config/database');
  const designService = require('../server/src/services/designService');
  const { findAccessibleWorkspace } = require('../server/src/utils/workspaceAccess');
  const { toPublicImageUrl, normalizeDesignIdea } = require('../server/src/utils/designIdea');
  const { UPLOAD_DIR } = require('../server/src/middleware/upload');

  await connectDB();
  const user = await authenticateRequest(req);
  const { fields, file, fileMeta } = await parseMultipartForm(req);

  const workspaceId = fields.workspaceId;
  const notes = fields.notes || '';
  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) return sendJson(res, 404, { error: 'Workspace not found' });

  if (!file && !String(notes).trim()) {
    if (workspace.brandProfile?.designIdea) {
      workspace.brandProfile.designIdea = undefined;
      await workspace.save();
    }
    return sendJson(res, 200, { designIdea: null });
  }

  const existing = workspace.brandProfile?.designIdea || {};
  let filename = existing.filename || null;

  if (file && fileMeta) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mime = fileMeta.mimeType || 'image/jpeg';
    if (!allowed.includes(mime)) {
      return sendJson(res, 400, { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' });
    }
    if (file.length > 8 * 1024 * 1024) {
      return sendJson(res, 400, { error: 'Image must be under 8 MB' });
    }
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = pathMod.extname(fileMeta.filename || '').toLowerCase() || '.jpg';
    filename = `${user._id}-${Date.now()}-design${ext}`;
    fs.writeFileSync(pathMod.join(UPLOAD_DIR, filename), file);
  }

  const designIdea = {
    notes: String(notes || '').trim(),
    filename,
    imageUrl: filename ? toPublicImageUrl(filename) : (existing.imageUrl || null),
    uploadedAt: file ? new Date() : (existing.uploadedAt || new Date()),
  };

  workspace.brandProfile = workspace.brandProfile || {};
  workspace.brandProfile.designIdea = designIdea;

  if (designIdea.imageUrl && file) {
    try {
      const ideaContext = await withTimeout(
        designService.resolveDesignIdeaContext(normalizeDesignIdea(designIdea)),
        22000,
        'Style analysis timed out',
      );
      if (ideaContext) {
        designIdea.analyzedDirection = ideaContext.direction;
        designIdea.analyzedSpec = ideaContext.spec;
        workspace.brandProfile.designIdea = designIdea;
      }
    } catch (err) {
      console.warn('[api] design idea analysis skipped:', err.message);
    }
  }

  await workspace.save();

  const responseIdea = { ...designIdea };
  if (file && file.length < 900000) {
    const mime = fileMeta?.mimeType || 'image/jpeg';
    responseIdea.previewDataUrl = `data:${mime};base64,${file.toString('base64')}`;
  }

  return sendJson(res, 200, { designIdea: responseIdea });
};

const authenticateRequest = async (req) => {
  const jwt = require('jsonwebtoken');
  const User = require('../server/src/models/User');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    const err = new Error('No token provided');
    err.status = 401;
    throw err;
  }
  if (!process.env.JWT_SECRET) {
    const err = new Error('JWT_SECRET is not configured');
    err.status = 503;
    throw err;
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }
  return user;
};

const handleDesignMedia = async (req, res) => {
  const { connectDB } = require('../server/src/config/database');
  const pexelsService = require('../server/src/services/pexelsService');
  await connectDB();
  await authenticateRequest(req);

  const pathOnly = requestPath(req);
  const q = getQueryParams(req);
  const page = Number(q.page) || 1;
  const perPage = Number(q.perPage) || (pathOnly.includes('/videos') ? 15 : 24);

  const result = pathOnly.includes('/videos')
    ? await pexelsService.searchVideos({ query: q.query, page, perPage })
    : await pexelsService.searchPhotos({ query: q.query, page, perPage });

  return sendJson(res, 200, result);
};

const isAuthMeRequest = (req) => {
  const pathOnly = requestPath(req);
  return req.method === 'GET' && (pathOnly === '/api/auth/me' || pathOnly === '/auth/me');
};

const handleAuthMe = async (req, res) => {
  const { connectDB } = require('../server/src/config/database');
  const { findAccessibleWorkspace } = require('../server/src/utils/workspaceAccess');
  await connectDB();
  const user = await authenticateRequest(req);

  let workspace = user.currentWorkspace
    ? await findAccessibleWorkspace(user.currentWorkspace, user._id)
    : null;
  if (!workspace) {
    workspace = await findAccessibleWorkspace(null, user._id);
  }

  return sendJson(res, 200, { user: formatUser(user), workspace });
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

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  }),
]);

const getContentType = (req) => String(req.headers['content-type'] || '').toLowerCase();

/** Multer and other parsers need the raw body stream — do not read or JSON.parse it here. */
const isStreamingBodyRequest = (req) => {
  const ct = getContentType(req);
  return ct.includes('multipart/form-data') || ct.includes('application/octet-stream');
};

const parseRequestBody = async (req) => {
  if (req._bodyParsed) return req.body;
  if (req.method === 'GET' || req.method === 'HEAD') {
    req._bodyParsed = true;
    return undefined;
  }
  if (isStreamingBodyRequest(req)) {
    req._bodyParsed = true;
    return undefined;
  }

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        req.body = {};
      }
    }
    req._bodyParsed = true;
    return req.body;
  }

  const readStream = async () => {
    if (typeof req[Symbol.asyncIterator] === 'function') {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks).toString('utf8');
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  };

  const raw = await withTimeout(readStream(), 8000, 'Request body read timed out');
  try {
    req.body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    const preview = String(raw || '').slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(`Invalid JSON request body: ${err.message}${preview ? ` (${preview}…)` : ''}`);
  }
  req._bodyParsed = true;
  return req.body;
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  plan: user.plan,
  credits: user.credits,
  currentWorkspace: user.currentWorkspace,
});

const handleLogin = async (req, res) => {
  const jwt = require('jsonwebtoken');
  const User = require('../server/src/models/User');
  const { findAccessibleWorkspace } = require('../server/src/utils/workspaceAccess');
  const { seedTestUser, TEST_USER } = require('../server/src/utils/seedTestUser');

  if (!process.env.JWT_SECRET) {
    return sendJson(res, 503, { error: 'JWT_SECRET is not configured' });
  }

  const body = await parseRequestBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return sendJson(res, 400, { error: 'Email and password are required' });
  }

  let user = await User.findOne({ email }).select('+password');
  if (
    !user
    && email === TEST_USER.email
    && password === TEST_USER.password
    && (process.env.SEED_DEMO_USER === 'true' || process.env.VERCEL)
  ) {
    await seedTestUser();
    user = await User.findOne({ email }).select('+password');
  }

  if (!user || !(await user.comparePassword(password))) {
    return sendJson(res, 401, { error: 'Invalid email or password' });
  }

  user.lastActiveAt = new Date();
  await user.save();

  let workspace = user.currentWorkspace
    ? await findAccessibleWorkspace(user.currentWorkspace, user._id)
    : null;
  if (!workspace) {
    workspace = await findAccessibleWorkspace(null, user._id);
    if (workspace) {
      user.currentWorkspace = workspace._id;
      await user.save();
    }
  }

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

  return sendJson(res, 200, { token, user: formatUser(user), workspace });
};

const handleRegister = async (req, res) => {
  const jwt = require('jsonwebtoken');
  const User = require('../server/src/models/User');
  const Workspace = require('../server/src/models/Workspace');
  const { acceptPendingInvite } = require('../server/src/services/userService');

  if (!process.env.JWT_SECRET) {
    return sendJson(res, 503, { error: 'JWT_SECRET is not configured' });
  }

  const body = await parseRequestBody(req);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = body.password;
  const inviteToken = body.inviteToken;

  if (!name) return sendJson(res, 400, { error: 'Name is required' });
  if (!email || !email.includes('@')) return sendJson(res, 400, { error: 'Valid email is required' });
  if (!password || password.length < 8) {
    return sendJson(res, 400, { error: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email });
  if (existing) return sendJson(res, 409, { error: 'Email already in use' });

  const user = await User.create({ name, email, password });

  let workspace = null;
  if (inviteToken) {
    workspace = await acceptPendingInvite(user, inviteToken);
    if (!workspace) {
      await User.findByIdAndDelete(user._id);
      return sendJson(res, 400, { error: 'Invalid invite — email must match the invitation' });
    }
  } else {
    workspace = await Workspace.create({ name: `${name}'s Brand`, owner: user._id });
    user.currentWorkspace = workspace._id;
    await user.save();
  }

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

  return sendJson(res, 201, { token, user: formatUser(user), workspace });
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
  const pathOnly = requestPath(req);
  const { connectDB } = require('../server/src/config/database');
  await connectDB();
  await ensureDemoUser();

  if (pathOnly === '/api/auth/login' && req.method === 'POST') {
    try {
      return await handleLogin(req, res);
    } catch (err) {
      console.error('[api] login failed:', err);
      return sendJson(res, 400, { error: err.message || 'Login failed' });
    }
  }

  if (pathOnly === '/api/auth/register' && req.method === 'POST') {
    try {
      return await handleRegister(req, res);
    } catch (err) {
      console.error('[api] register failed:', err);
      return sendJson(res, 400, { error: err.message || 'Registration failed' });
    }
  }

  await parseRequestBody(req);

  if (!authHandler) {
    const express = require('express');
    const app = express();
    app.set('trust proxy', 1);
    app.use('/api/auth', require('../server/src/routes/auth'));
    authHandler = serverless(app);
  }

  return await authHandler(req, res);
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

  if (isAuthMeRequest(req)) {
    try {
      return await handleAuthMe(req, res);
    } catch (err) {
      console.error('[api] auth/me failed:', err);
      return sendJson(res, err.status || 401, { error: err.message });
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

  if (isDesignMediaRequest(req)) {
    try {
      return await handleDesignMedia(req, res);
    } catch (err) {
      console.error('[api] design media failed:', err);
      return sendJson(res, err.status || 502, { error: err.message });
    }
  }

  if (isDesignFastRequest(req)) {
    try {
      normalizeRequestUrl(req);
      await parseRequestBody(req);
      return await handleDesignFast(req, res);
    } catch (err) {
      console.error('[api] design fast failed:', err);
      return sendJson(res, err.status || 502, { error: err.message });
    }
  }

  if (isDesignIdeaRequest(req)) {
    try {
      normalizeRequestUrl(req);
      return await handleDesignIdea(req, res);
    } catch (err) {
      console.error('[api] design idea failed:', err);
      return sendJson(res, err.status || 502, { error: err.message || 'Upload failed' });
    }
  }

  if (isDiscoverRequest(req)) {
    try {
      normalizeRequestUrl(req);
      await parseRequestBody(req);
      return await handleDiscover(req, res);
    } catch (err) {
      console.error('[api] discover bootstrap failed:', err);
      return sendJson(res, err.status || 502, { error: err.message });
    }
  }

  if (isCreateFastRequest(req)) {
    try {
      normalizeRequestUrl(req);
      await parseRequestBody(req);
      return await handleCreateFast(req, res);
    } catch (err) {
      console.error('[api] create fast failed:', err);
      return sendJson(res, err.status || 502, { error: err.message });
    }
  }

  try {
    normalizeRequestUrl(req);
    if (!isStreamingBodyRequest(req)) {
      await parseRequestBody(req);
    }
    if (!handler) {
      const { getApp } = require('../server/src/app');
      const app = await getApp();
      handler = serverless(app, { binary: ['image/*', 'multipart/form-data'] });
    }
    return await handler(req, res);
  } catch (err) {
    console.error('[api] bootstrap failed:', err);
    return sendJson(res, 503, { status: 'error', error: err.message });
  }
};
