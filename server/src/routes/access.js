const express = require('express');
const {
  isGateEnabled,
  signAccessToken,
  verifyAccessToken,
  verifyCredentials,
  bootstrapGate,
} = require('../services/siteAccessService');

const router = express.Router();

router.get('/status', async (req, res) => {
  const enabled = await isGateEnabled();
  if (!enabled) {
    return res.json({ enabled: false, granted: true, configured: false });
  }

  const header = req.headers.authorization?.split(' ')[1];
  const granted = verifyAccessToken(header);
  return res.json({ enabled: true, granted, configured: true });
});

router.post('/verify', async (req, res) => {
  const enabled = await isGateEnabled();
  if (!enabled) {
    return res.json({ ok: true, disabled: true, token: null });
  }

  const { username, code } = req.body || {};
  if (!(await verifyCredentials(username, code))) {
    return res.status(401).json({ error: 'Invalid username or access code' });
  }

  return res.json({ ok: true, token: signAccessToken() });
});

router.post('/bootstrap', async (req, res) => {
  try {
    const { username, code, secret } = req.body || {};
    await bootstrapGate({ username, code, secret });
    return res.json({ ok: true, configured: true });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Bootstrap failed' });
  }
});

module.exports = router;
