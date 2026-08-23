const express = require('express');
const {
  isGateEnabled,
  signAccessToken,
  verifyAccessToken,
  verifyCredentials,
} = require('../utils/siteAccess');

const router = express.Router();

router.get('/status', (req, res) => {
  if (!isGateEnabled()) {
    return res.json({ enabled: false, granted: true });
  }

  const header = req.headers.authorization?.split(' ')[1];
  const granted = verifyAccessToken(header);
  return res.json({ enabled: true, granted });
});

router.post('/verify', (req, res) => {
  if (!isGateEnabled()) {
    return res.json({ ok: true, disabled: true, token: null });
  }

  const { username, code } = req.body || {};
  if (!verifyCredentials(username, code)) {
    return res.status(401).json({ error: 'Invalid username or access code' });
  }

  return res.json({ ok: true, token: signAccessToken() });
});

module.exports = router;
