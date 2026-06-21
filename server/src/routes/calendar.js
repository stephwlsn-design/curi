const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { generateCalendar } = require('../services/moduleService');
const { saveCalendarToQueue } = require('../services/growthService');
const CalendarEntry = require('../models/CalendarEntry');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/generate', checkCredits(10), async (req, res) => {
  const { workspaceId, days = 30, goal } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const calendar = await generateCalendar({ brandProfile: workspace.brandProfile, days, goal });
  await req.user.deductCredits(req.creditCost);

  res.json({ calendar: calendar.entries || [], days });
});

router.post('/save', async (req, res) => {
  const { workspaceId, entries = [], goal } = req.body;
  if (!entries.length) return res.status(400).json({ error: 'No calendar entries to save' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const result = await saveCalendarToQueue({
    workspaceId: workspace._id,
    userId: req.user._id,
    entries,
    goal,
  });

  res.json({
    ...result,
    message: `${result.count} posts sent to the approval queue`,
  });
});

router.get('/entries', async (req, res) => {
  const { workspaceId } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const entries = await CalendarEntry.find({ workspace: workspaceId, autonomousRun: { $exists: false } })
    .populate('content', 'title status platform')
    .sort({ day: 1 })
    .limit(100)
    .lean();

  res.json({ entries });
});

router.get('/', async (req, res) => {
  res.json({ module: 'calendar', status: 'live' });
});

module.exports = router;
