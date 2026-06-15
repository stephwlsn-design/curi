const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { repurposeContent } = require('../services/moduleService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/generate', checkCredits(5), async (req, res) => {
  const { workspaceId, sourceContent, sourceType = 'blog' } = req.body;
  if (!sourceContent?.trim()) return res.status(400).json({ error: 'Source content is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await repurposeContent({ brandProfile: workspace.brandProfile, sourceContent, sourceType });
  await req.user.deductCredits(req.creditCost);

  res.json(result);
});

router.get('/', async (req, res) => res.json({ module: 'repurpose', status: 'live' }));

module.exports = router;
