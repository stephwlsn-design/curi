const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { generateCalendar } = require('../services/moduleService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/generate', checkCredits(10), async (req, res) => {
  const { workspaceId, days = 30, goal } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const calendar = await generateCalendar({ brandProfile: workspace.brandProfile, days, goal });
  await req.user.deductCredits(req.creditCost);

  res.json({ calendar: calendar.entries, days });
});

router.get('/', async (req, res) => {
  res.json({ module: 'calendar', status: 'live' });
});

module.exports = router;
