const AutonomousRun = require('../models/AutonomousRun');
const Content = require('../models/Content');
const { PIPELINE_STEPS, advanceAutonomousPipeline } = require('../services/autonomousEngineService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const User = require('../models/User');

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

const createAutonomousRun = async ({ user, body }) => {
  const { workspaceId, days = 30, channels = [], designIdea } = body;
  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const creditCost = 100;
  const userWithCredits = await User.findById(user._id);
  if (!userWithCredits) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }
  if (userWithCredits.credits < creditCost) {
    const err = new Error('Insufficient credits');
    err.status = 402;
    err.details = { required: creditCost, available: userWithCredits.credits };
    throw err;
  }

  await AutonomousRun.updateMany(
    {
      workspace: workspaceId,
      createdBy: user._id,
      status: { $in: ['queued', 'running'] },
    },
    {
      $set: { status: 'failed', error: 'Superseded by a new campaign run' },
      $unset: { processingLockAt: 1 },
    },
  );

  const runDesignIdea = designIdea || workspace.brandProfile?.designIdea || null;
  const run = await AutonomousRun.create({
    workspace: workspaceId,
    createdBy: user._id,
    days,
    channels,
    designIdea: runDesignIdea,
    status: 'queued',
    steps: PIPELINE_STEPS.map((name) => ({ name, status: 'pending' })),
  });

  await userWithCredits.deductCredits(creditCost);
  return { run, message: `Autonomous ${days}-day campaign started` };
};

const advanceAutonomousRun = async ({ user, runId, forceUnlock = false }) => {
  const run = await AutonomousRun.findOne({ _id: runId, createdBy: user._id });
  if (!run) {
    const err = new Error('Run not found');
    err.status = 404;
    throw err;
  }

  if (!['queued', 'running'].includes(run.status)) {
    const fresh = await AutonomousRun.findById(run._id).populate('strategy');
    return { ...(await fetchRunPayload(fresh)), message: 'Pipeline not active' };
  }

  if (forceUnlock) {
    await AutonomousRun.findByIdAndUpdate(runId, { $unset: { processingLockAt: 1 } });
  }

  let updated = await advanceAutonomousPipeline(runId);
  if (!updated) {
    await AutonomousRun.findByIdAndUpdate(runId, { $unset: { processingLockAt: 1 } });
    updated = await advanceAutonomousPipeline(runId);
  }

  const fresh = await AutonomousRun.findById(updated?._id || runId).populate('strategy');
  return fetchRunPayload(fresh);
};

const getAutonomousRun = async ({ user, runId }) => {
  const run = await AutonomousRun.findOne({ _id: runId, createdBy: user._id }).populate('strategy');
  if (!run) {
    const err = new Error('Run not found');
    err.status = 404;
    throw err;
  }
  return fetchRunPayload(run);
};

const getAutonomousHistory = async ({ user, workspaceId, page = 1, limit = 20 }) => {
  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  const filter = { workspace: workspaceId, createdBy: user._id };
  const skip = (Number(page) - 1) * Number(limit);
  const [runs, total] = await Promise.all([
    AutonomousRun.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    AutonomousRun.countDocuments(filter),
  ]);
  return {
    runs,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  };
};

module.exports = {
  fetchRunPayload,
  createAutonomousRun,
  advanceAutonomousRun,
  getAutonomousRun,
  getAutonomousHistory,
};
