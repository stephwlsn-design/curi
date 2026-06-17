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
const { PIPELINE_STEPS, advanceAutonomousPipeline } = require('../services/autonomousEngineService');
const { enqueueAutonomousRun, enqueueTopicDiscovery } = require('../workers');
const UserPreferences = require('../models/UserPreferences');
const { getTopPreferences } = require('../services/learningService');
const { uploadUserDesigns } = require('../middleware/upload');
const { createUploadedDesign } = require('../services/designUploadService');

const fetchRunPayload = async (run) => {
  const runId = String(run._id);
  const runFilter = {
    workspace: run.workspace,
    'metadata.module': 'autonomous',
    $or: [{ 'metadata.runId': runId }, { 'metadata.runId': run._id }],
  };
  const creatives = await Content.find({ ...runFilter, type: { $in: ['image', 'video'] } }).sort({ createdAt: 1 });
  const posts = await Content.find({ ...runFilter, type: 'post' }).sort({ createdAt: 1 });
  return {
    run,
    posts,
    designs: creatives.filter((c) => c.type === 'image'),
    videos: creatives.filter((c) => c.type === 'video'),
  };
};

router.post('/generate', checkCredits(100), async (req, res) => {
  const { workspaceId, days = 30, channels = [], designIdea } = req.body;

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const runDesignIdea = designIdea || workspace.brandProfile?.designIdea || null;

  const run = await AutonomousRun.create({
    workspace: workspaceId,
    createdBy: req.user._id,
    days,
    channels,
    designIdea: runDesignIdea,
    status: 'queued',
    steps: PIPELINE_STEPS.map(name => ({ name, status: 'pending' })),
  });

  await req.user.deductCredits(req.creditCost);
  if (process.env.VERCEL) {
    // Vercel: client polling advances the pipeline step-by-step
    enqueueAutonomousRun(run._id).catch(() => {});
  } else {
    enqueueAutonomousRun(run._id);
  }

  res.status(202).json({ run, message: `Autonomous ${days}-day campaign started` });
});

router.post('/run/:id/advance', async (req, res) => {
  const run = await AutonomousRun.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (!['queued', 'running'].includes(run.status)) {
    const payload = await fetchRunPayload(await AutonomousRun.findById(run._id).populate('strategy'));
    return res.json({ ...payload, message: 'Pipeline not active' });
  }
  try {
    const updated = await advanceAutonomousPipeline(run._id);
    const fresh = await AutonomousRun.findById(updated?._id || run._id).populate('strategy');
    const payload = await fetchRunPayload(fresh);
    return res.json(payload);
  } catch (err) {
    const failed = await AutonomousRun.findById(run._id).populate('strategy');
    const payload = await fetchRunPayload(failed);
    return res.status(502).json({ error: err.message, ...payload });
  }
});

router.get('/run/:id', async (req, res) => {
  const run = await AutonomousRun.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  }).populate('strategy');

  if (!run) return res.status(404).json({ error: 'Run not found' });

  res.json(await fetchRunPayload(run));
});

router.get('/history', async (req, res) => {
  const { workspaceId, page = 1, limit = 20 } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const filter = { workspace: workspaceId, createdBy: req.user._id };
  const skip = (Number(page) - 1) * Number(limit);
  const [runs, total] = await Promise.all([
    AutonomousRun.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    AutonomousRun.countDocuments(filter),
  ]);

  res.json({
    runs,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
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
