const express = require('express');
const router = express.Router();
const publishService = require('../services/publishService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/now', async (req, res) => {
  const { contentId, platform } = req.body;
  const content = await Content.findById(contentId);
  if (!content) return res.status(404).json({ error: 'Content not found' });

  const workspace = await findAccessibleWorkspace(content.workspace, req.user._id);
  if (!workspace) return res.status(403).json({ error: 'Access denied' });

  const socialAccount = req.user.socialAccounts.find(a => a.platform === platform);
  if (!socialAccount) return res.status(400).json({ error: `No ${platform} account connected` });

  const result = await publishService.publish({ content, socialAccount, platform });
  content.status = 'published';
  content.publishedAt = new Date();
  await content.save();

  res.json({ result, message: 'Published successfully' });
});

router.post('/schedule', async (req, res) => {
  const { contentId, scheduledAt } = req.body;
  const content = await Content.findById(contentId);
  if (!content) return res.status(404).json({ error: 'Content not found' });

  const workspace = await findAccessibleWorkspace(content.workspace, req.user._id);
  if (!workspace) return res.status(403).json({ error: 'Access denied' });

  content.status = 'scheduled';
  content.scheduledAt = new Date(scheduledAt);
  await content.save();
  res.json({ content });
});

router.post('/connect/:platform', async (req, res) => {
  const { platform } = req.params;
  const { accessToken, refreshToken, accountId, accountName, expiresAt } = req.body;

  const user = req.user;
  const existingIdx = user.socialAccounts.findIndex(a => a.platform === platform);
  const account = { platform, accessToken, refreshToken, accountId, accountName, expiresAt };

  if (existingIdx >= 0) user.socialAccounts[existingIdx] = account;
  else user.socialAccounts.push(account);

  await user.save();
  res.json({
    message: `${platform} connected`,
    accounts: user.socialAccounts.map(a => ({ platform: a.platform, accountName: a.accountName })),
  });
});

module.exports = router;
