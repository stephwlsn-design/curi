const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { scanTrends } = require('../services/moduleService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/scan', checkCredits(3), async (req, res) => {
  const { workspaceId, industry } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await scanTrends({ brandProfile: workspace.brandProfile, industry });
  await req.user.deductCredits(req.creditCost);

  res.json(result);
});

router.get('/', async (req, res) => res.json({ module: 'trends', status: 'live' }));

module.exports = router;
