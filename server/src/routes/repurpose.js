const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { repurposeContent } = require('../services/moduleService');
const { saveRepurposedFormats } = require('../services/growthService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/generate', checkCredits(5), async (req, res) => {
  const { workspaceId, sourceContent, sourceType = 'blog' } = req.body;
  if (!sourceContent?.trim()) return res.status(400).json({ error: 'Source content is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await repurposeContent({ brandProfile: workspace.brandProfile, sourceContent, sourceType });
  await req.user.deductCredits(req.creditCost);

  res.json({ formats: result.formats || [] });
});

router.post('/save', async (req, res) => {
  const { workspaceId, formats = [], sourceType } = req.body;
  if (!formats.length) return res.status(400).json({ error: 'No formats to save' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await saveRepurposedFormats({
    workspaceId: workspace._id,
    userId: req.user._id,
    formats,
    sourceType,
  });

  res.json({
    ...result,
    message: `${result.count} formats saved to your content library`,
  });
});

router.get('/', async (req, res) => res.json({ module: 'repurpose', status: 'live' }));

module.exports = router;
