const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const AutonomousRun = require('../models/AutonomousRun');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const Topic = require('../models/Topic');
const Strategy = require('../models/Strategy');
const CalendarEntry = require('../models/CalendarEntry');
const PublishJob = require('../models/PublishJob');
const Content = require('../models/Content');
const {
  fetchRunPayload,
  createAutonomousRun,
  advanceAutonomousRun,
  getAutonomousRun,
  getAutonomousHistory,
} = require('../handlers/autonomousFast');
const { enqueueAutonomousRun, enqueueTopicDiscovery } = require('../workers');
const UserPreferences = require('../models/UserPreferences');
const { getTopPreferences } = require('../services/learningService');
const { uploadUserDesigns } = require('../middleware/upload');
const { createUploadedDesign } = require('../services/designUploadService');

router.post('/generate', checkCredits(100), async (req, res) => {
  try {
    const { run, message } = await createAutonomousRun({ user: req.user, body: req.body });
    if (!process.env.VERCEL) {
      enqueueAutonomousRun(run._id);
    } else {
      enqueueAutonomousRun(run._id).catch(() => {});
    }
    res.status(202).json({ run, message });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      ...(err.details || {}),
    });
  }
});

router.post('/run/:id/advance', async (req, res) => {
  try {
    const payload = await advanceAutonomousRun({
      user: req.user,
      runId: req.params.id,
      forceUnlock: Boolean(req.body?.forceUnlock),
    });
    return res.json(payload);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    try {
      const AutonomousRun = require('../models/AutonomousRun');
      const failed = await AutonomousRun.findById(req.params.id).populate('strategy');
      if (failed) {
        const payload = await fetchRunPayload(failed);
        return res.status(502).json({ error: err.message, ...payload });
      }
    } catch { /* ignore */ }
    return res.status(502).json({ error: err.message });
  }
});

router.get('/run/:id', async (req, res) => {
  try {
    const payload = await getAutonomousRun({ user: req.user, runId: req.params.id });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const payload = await getAutonomousHistory({
      user: req.user,
      workspaceId: req.query.workspaceId,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/runs', async (req, res) => {
  const { workspaceId, limit = 20 } = req.query;
  const runs = await AutonomousRun.find({ workspace: workspaceId, createdBy: req.user._id })
    .sort({ createdAt: -1 }).limit(Number(limit));
  res.json({ runs });
});

router.get('/topics', async (req, res) => {
  const { workspaceId } = req.query;
  const topics = await Topic.find({ workspace: workspaceId, status: 'active' })
    .sort({ relevance: -1 }).limit(50);
  res.json({ topics });
});

router.post('/topics/discover', checkCredits(5), async (req, res) => {
  const { workspaceId } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  await req.user.deductCredits(req.creditCost);
  enqueueTopicDiscovery(workspaceId);

  res.status(202).json({ message: 'Topic discovery started' });
});

router.get('/strategy/:id', async (req, res) => {
  const strategy = await Strategy.findById(req.params.id);
  if (!strategy) return res.status(404).json({ error: 'Strategy not found' });

  const entries = await CalendarEntry.find({ strategy: strategy._id }).sort({ day: 1 });
  res.json({ strategy, entries });
});

router.get('/calendar', async (req, res) => {
  const { workspaceId, runId } = req.query;
  const filter = { workspace: workspaceId };
  if (runId) filter.autonomousRun = runId;

  const entries = await CalendarEntry.find(filter).populate('content').sort({ day: 1 });
  res.json({ entries });
});

router.get('/creatives', async (req, res) => {
  const { workspaceId, runId } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const filter = {
    workspace: workspaceId,
    'metadata.module': 'autonomous',
    type: { $in: ['image', 'video'] },
  };
  if (runId) filter['metadata.runId'] = String(runId);

  const items = await Content.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({
    designs: items.filter(i => i.type === 'image'),
    videos: items.filter(i => i.type === 'video'),
  });
});

router.get('/publish-queue', async (req, res) => {
  const { workspaceId } = req.query;
  const jobs = await PublishJob.find({ workspace: workspaceId })
    .populate('content')
    .sort({ scheduledAt: 1 }).limit(50);
  res.json({ jobs });
});

router.get('/preferences', async (req, res) => {
  const { workspaceId } = req.query;
  const prefs = await UserPreferences.findOne({ workspace: workspaceId });
  res.json({ preferences: getTopPreferences(prefs) });
});

router.get('/workflow', (req, res) => {
  res.json({
    steps: [
      'Brand Setup', 'Topic Discovery', 'Content Strategy', 'Content Generation',
      'Creative Generation', 'Video Generation', 'Approval Workflow',
      'Publishing Engine', 'Performance Tracking', 'Learning Engine',
    ],
  });
});

router.post('/run/:id/bulk-designs', uploadUserDesigns.array('images', 30), async (req, res) => {
  const run = await AutonomousRun.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one design image' });

  let assignments = [];
  try {
    assignments = req.body.assignments ? JSON.parse(req.body.assignments) : [];
  } catch {
    return res.status(400).json({ error: 'Invalid assignments JSON' });
  }

  const entries = await CalendarEntry.find({ autonomousRun: run._id })
    .sort({ day: 1 })
    .populate('content');

  const autoMatch = req.body.autoMatch === 'true' || req.body.autoMatch === true;
  const defaultSchedule = req.body.scheduleAll === 'true' || req.body.scheduleAll === true;
  const globalScheduledAt = req.body.scheduledAt || null;

  if (!assignments.length && autoMatch) {
    const withContent = entries.filter(e => e.content || e.caption || e.topic);
    assignments = req.files.map((file, i) => ({
      fileIndex: i,
      calendarEntryId: withContent[i]?._id,
      scheduledAt: globalScheduledAt || null,
    })).filter(a => a.calendarEntryId);
  }

  if (!assignments.length) {
    return res.status(400).json({ error: 'Provide assignments or enable autoMatch' });
  }

  const results = [];
  const runId = String(run._id);

  for (const assignment of assignments) {
    const file = req.files[assignment.fileIndex];
    if (!file) continue;

    const entry = await CalendarEntry.findById(assignment.calendarEntryId);
    if (!entry) continue;

    const postId = entry.content?._id || entry.content;
    const scheduledAt = assignment.scheduledAt || (defaultSchedule ? globalScheduledAt : null);

    const design = await createUploadedDesign({
      workspaceId: run.workspace,
      userId: req.user._id,
      file,
      platform: assignment.platform || entry.platform || 'instagram',
      title: assignment.title || `Design — Day ${entry.day}`,
      scheduledAt,
      calendarEntryId: entry._id,
      runId,
      module: 'autonomous',
      linkPostId: postId,
    });

    entry.status = scheduledAt ? 'scheduled' : 'generated';
    await entry.save();
    results.push({ entryId: entry._id, day: entry.day, design });
  }

  run.stats.designsGenerated = (run.stats.designsGenerated || 0) + results.length;
  if (defaultSchedule || assignments.some(a => a.scheduledAt)) {
    run.stats.scheduled = (run.stats.scheduled || 0) + results.filter(r => r.design?.status === 'scheduled').length;
  }
  await run.save();

  res.status(201).json({
    assigned: results.length,
    designs: results.map(r => r.design),
    message: `Attached ${results.length} uploaded design(s) to campaign content`,
  });
});

module.exports = router;
