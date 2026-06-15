const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { analyzeCompetitor } = require('../services/moduleService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/analyze', checkCredits(10), async (req, res) => {
  const { workspaceId, competitorUrl, competitorName } = req.body;
  if (!competitorUrl && !competitorName) return res.status(400).json({ error: 'Competitor URL or name required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await analyzeCompetitor({ brandProfile: workspace.brandProfile, competitorUrl, competitorName });
  await req.user.deductCredits(req.creditCost);

  res.json({ analysis: result });
});

router.get('/', async (req, res) => res.json({ module: 'competitor', status: 'live' }));

module.exports = router;
