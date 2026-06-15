const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const discoverService = require('../services/discoverService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { mergeBrandProfile } = require('../utils/brandProfile');
const logger = require('../utils/logger');

const VOICES = ['professional', 'casual', 'witty', 'bold', 'authoritative', 'friendly'];

const sanitizeProfile = (profile, url) => {
  const clean = { ...profile };
  delete clean._source;
  delete clean._aiNote;
  if (clean.voice && !VOICES.includes(clean.voice)) {
    clean.voice = VOICES.find(v => v === clean.voice?.toLowerCase()) || 'professional';
  }
  clean.url = url;
  clean.lastDiscoveredAt = new Date();
  return clean;
};

// POST /api/discover — run brand discovery on URL
router.post('/', checkCredits(5), async (req, res) => {
  let { url, workspaceId } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'URL is required' });
  if (!workspaceId) return res.status(400).json({ error: 'Workspace not loaded. Sign out and sign in again.' });

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found. Sign out and sign in again.' });

  try {
    const result = await discoverService.analyzeWebsite(url);
    const { _source, _aiNote, ...brandData } = result;
    const brandProfile = sanitizeProfile(brandData, url);

    workspace.brandProfile = mergeBrandProfile(workspace.brandProfile, brandProfile);
    await workspace.save();
    await req.user.deductCredits(req.creditCost);

    res.json({
      brandProfile: workspace.brandProfile,
      source: _source || 'ai',
      note: _aiNote || null,
    });
  } catch (err) {
    logger.error(`Discover failed: ${err.message}`);
    const message = discoverService.friendlyAIError(err) || err.message || 'Analysis failed';
    res.status(502).json({ error: message });
  }
});

module.exports = router;
