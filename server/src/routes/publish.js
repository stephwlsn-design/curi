const express = require('express');
const User = require('../models/User');
const router = express.Router();
const publishService = require('../services/publishService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { scheduleContent } = require('../services/designUploadService');
const { listAccountsForUser, resolveSocialAccount, normalizePlatform } = require('../services/socialAccountService');
const { getOAuthUrl, exchangeOAuthCode, consumeState, saveAccountsOnUser } = require('../services/socialOAuthService');
const { isPlatformConfigured, isOAuthConfigured, listConfiguredPlatforms } = require('../config/social');

const settingsRedirect = (params = {}, statePayload = null) => {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');
  const qs = new URLSearchParams(params).toString();
  if (statePayload?.returnTo === 'channels') {
    return `${base}/channels${qs ? `?${qs}` : ''}`;
  }
  return `${base}/settings?tab=publishing${qs ? `&${qs}` : ''}`;
};

const publicRouter = express.Router();

publicRouter.get('/callback/:platform', async (req, res) => {
  const platform = normalizePlatform(req.params.platform);
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.redirect(settingsRedirect({ error: errorDescription || error }));
  }
  if (!code || !state) {
    return res.redirect(settingsRedirect({ error: 'OAuth callback missing code or state' }));
  }

  const statePayload = consumeState(state);
  const metaCallback = platform === 'facebook' && statePayload?.platform === 'meta';
  if (!statePayload || (!metaCallback && statePayload.platform !== platform)) {
    return res.redirect(settingsRedirect({ error: 'OAuth session expired — try connecting again' }, statePayload));
  }

  try {
    const user = await User.findById(statePayload.userId);
    if (!user) return res.redirect(settingsRedirect({ error: 'User not found' }, statePayload));

    if (metaCallback) {
      const accounts = await exchangeOAuthCode('meta', code, statePayload);
      saveAccountsOnUser(user, accounts);
      await user.save();
      const connected = accounts.map((a) => a.platform).join(',');
      return res.redirect(settingsRedirect({ connected }, statePayload));
    }

    const account = await exchangeOAuthCode(platform, code, statePayload);
    saveAccountsOnUser(user, [account]);
    await user.save();

    return res.redirect(settingsRedirect({ connected: platform }, statePayload));
  } catch (err) {
    const message = err.response?.data?.error_description
      || err.response?.data?.error
      || err.message;
    return res.redirect(settingsRedirect({ error: message }, statePayload));
  }
});

router.get('/accounts', async (req, res) => {
  res.json({
    accounts: listAccountsForUser(req.user),
    configuredPlatforms: listConfiguredPlatforms(),
    oauthAvailable: ['linkedin', 'twitter', 'instagram', 'facebook'].filter((p) => isOAuthConfigured(p)),
    metaOAuth: isOAuthConfigured('facebook'),
  });
});

router.get('/oauth/:platform', async (req, res) => {
  const platform = normalizePlatform(req.params.platform);
  const returnTo = req.query.returnTo;
  try {
    const url = getOAuthUrl(platform, req.user._id.toString(), { returnTo });
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/social-stats', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
  try {
    const { getSocialStats } = require('../services/socialInsightsService');
    const data = await getSocialStats({ workspaceId, user: req.user });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/now', async (req, res) => {
  const { contentId, platform: rawPlatform } = req.body;
  const platform = normalizePlatform(rawPlatform);

  const content = await Content.findById(contentId);
  if (!content) return res.status(404).json({ error: 'Content not found' });

  const workspace = await findAccessibleWorkspace(content.workspace, req.user._id);
  if (!workspace) return res.status(403).json({ error: 'Access denied' });

  const socialAccount = resolveSocialAccount(req.user, platform);
  if (!socialAccount) {
    return res.status(400).json({
      error: `No ${platform} account connected — connect in Settings → Publishing`,
      connectUrl: `${(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0]}/settings?tab=publishing`,
    });
  }

  try {
    const result = await publishService.publish({ content, socialAccount, platform });
    content.status = 'published';
    content.publishedAt = new Date();
    content.platform = platform;
    content.publishError = undefined;
    await content.save();
    res.json({ result, message: 'Published successfully' });
  } catch (err) {
    const message = err.response?.data?.error?.message
      || err.response?.data?.message
      || err.message;
    res.status(502).json({ error: message });
  }
});

router.post('/schedule', async (req, res) => {
  const { contentId, scheduledAt, platform } = req.body;
  if (!contentId || !scheduledAt) {
    return res.status(400).json({ error: 'contentId and scheduledAt are required' });
  }

  const content = await Content.findById(contentId);
  if (!content) return res.status(404).json({ error: 'Content not found' });

  const workspace = await findAccessibleWorkspace(content.workspace, req.user._id);
  if (!workspace) return res.status(403).json({ error: 'Access denied' });

  const targetPlatform = normalizePlatform(platform || content.platform);
  const socialAccount = resolveSocialAccount(req.user, targetPlatform);
  if (!socialAccount) {
    return res.status(400).json({
      error: `No ${targetPlatform} account connected — connect in Settings → Publishing`,
    });
  }

  const { content: updated } = await scheduleContent({
    content,
    platform: targetPlatform,
    scheduledAt,
    workspaceId: workspace._id,
    userId: req.user._id,
  });

  res.json({ content: updated, message: 'Content scheduled for publishing' });
});

router.post('/connect/:platform', async (req, res) => {
  const platform = normalizePlatform(req.params.platform);
  const { accessToken, refreshToken, accountId, accountName, expiresAt } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  const user = req.user;
  const account = {
    platform,
    accessToken,
    refreshToken,
    accountId,
    accountName: accountName || platform,
    expiresAt,
  };

  const existingIdx = user.socialAccounts.findIndex((a) => a.platform === platform);
  if (existingIdx >= 0) user.socialAccounts[existingIdx] = account;
  else user.socialAccounts.push(account);

  await user.save();
  res.json({
    message: `${platform} connected`,
    accounts: listAccountsForUser(user),
  });
});

router.delete('/disconnect/:platform', async (req, res) => {
  const platform = normalizePlatform(req.params.platform);
  req.user.socialAccounts = req.user.socialAccounts.filter((a) => a.platform !== platform);
  await req.user.save();
  res.json({
    message: `${platform} disconnected`,
    accounts: listAccountsForUser(req.user),
  });
});

module.exports = router;
module.exports.publicRouter = publicRouter;
