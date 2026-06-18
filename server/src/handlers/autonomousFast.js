const AutonomousRun = require('../models/AutonomousRun');
const Content = require('../models/Content');
const Workspace = require('../models/Workspace');
const { PIPELINE_STEPS, advanceAutonomousPipeline } = require('../services/autonomousEngineService');
const { runIdFilter } = require('../services/approvalService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { mergeDesignIdeaSources } = require('../utils/designIdea');
const { hydrateDesignContent } = require('../utils/designStorage');

const User = require('../models/User');

const sanitizeDesignIdea = (idea) => {
  if (!idea) return null;
  return {
    notes: idea.notes || undefined,
    filename: idea.filename || undefined,
    imageUrl: idea.imageUrl || undefined,
    previewDataUrl: idea.previewDataUrl || undefined,
    analyzedDirection: idea.analyzedDirection || undefined,
    analyzedSpec: idea.analyzedSpec || undefined,
    uploadedAt: idea.uploadedAt || undefined,
  };
};

const mergeDesignIdeas = (fromBody, fromWorkspace) => {
  const a = fromBody || {};
  const b = fromWorkspace || {};
  if (!a.notes && !a.imageUrl && !a.filename && !a.previewDataUrl && !a.analyzedDirection && !a.analyzedSpec
    && !b.notes && !b.imageUrl && !b.filename && !b.previewDataUrl && !b.analyzedDirection && !b.analyzedSpec) {
    return null;
  }
  return sanitizeDesignIdea({
    notes: a.notes || b.notes,
    filename: a.filename || b.filename,
    imageUrl: a.imageUrl || b.imageUrl,
    previewDataUrl: a.previewDataUrl || b.previewDataUrl,
    analyzedDirection: a.analyzedDirection || b.analyzedDirection,
    analyzedSpec: a.analyzedSpec || b.analyzedSpec,
    uploadedAt: a.uploadedAt || b.uploadedAt,
  });
};

const fetchRunPayload = async (run) => {
  const runId = String(run._id);
  const runFilter = {
    workspace: run.workspace,
    'metadata.module': 'autonomous',
    ...runIdFilter(runId),
  };
  const ws = await Workspace.findById(run.workspace).select('brandProfile.designIdea').lean();
  const designIdeaForHydrate = mergeDesignIdeaSources(run.designIdea, ws?.brandProfile?.designIdea)
    || run.designIdea
    || ws?.brandProfile?.designIdea
    || null;
  const creatives = await Content.find({ ...runFilter, type: { $in: ['image', 'video'] } }).sort({ createdAt: 1 });
  const posts = await Content.find({ ...runFilter, type: 'post' }).sort({ createdAt: 1 });
  const hydratedDesigns = creatives
    .filter((c) => c.type === 'image')
    .map((d) => hydrateDesignContent(d, designIdeaForHydrate));
  return {
    run: designIdeaForHydrate && JSON.stringify(designIdeaForHydrate) !== JSON.stringify(run.designIdea || {})
      ? { ...run.toObject?.() ?? run, designIdea: designIdeaForHydrate }
      : run,
    posts,
    designs: hydratedDesigns,
    videos: creatives.filter((c) => c.type === 'video'),
  };
};

const createAutonomousRun = async ({ user, body }) => {
  const { workspaceId, days = 30, channels = [], designIdea, contentPrompt = '' } = body;
  if (!workspaceId) {
    const err = new Error('Workspace not loaded');
    err.status = 400;
    throw err;
  }
  const creditCost = 100;
  const [workspace, userWithCredits] = await Promise.all([
    findAccessibleWorkspace(workspaceId, user._id),
    User.findById(user._id),
  ]);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
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

  const runDesignIdea = mergeDesignIdeas(designIdea, workspace.brandProfile?.designIdea)
    || mergeDesignIdeas(null, workspace.brandProfile?.designIdea);
  const run = await AutonomousRun.create({
    workspace: workspaceId,
    createdBy: user._id,
    days,
    channels,
    designIdea: runDesignIdea,
    contentPrompt: String(contentPrompt || '').trim().slice(0, 2000),
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

  const result = await advanceAutonomousPipeline(runId);
  let updatedRun = result?.run;
  const busy = Boolean(result?.busy);

  if (!updatedRun && !busy) {
    await AutonomousRun.findByIdAndUpdate(runId, { $unset: { processingLockAt: 1 } });
    const retry = await advanceAutonomousPipeline(runId);
    updatedRun = retry?.run;
    if (retry?.busy) {
      const fresh = await AutonomousRun.findById(runId).populate('strategy');
      return { ...(await fetchRunPayload(fresh)), warning: 'Pipeline step in progress — retry shortly' };
    }
  }

  const fresh = await AutonomousRun.findById(updatedRun?._id || runId).populate('strategy');
  const payload = await fetchRunPayload(fresh);
  if (busy) {
    payload.warning = 'Pipeline step in progress — retry shortly';
  }
  return payload;
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

const getAutonomousCalendar = async ({ user, workspaceId, runId }) => {
  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  const CalendarEntry = require('../models/CalendarEntry');
  const filter = { workspace: workspaceId };
  if (runId) filter.autonomousRun = runId;
  const entries = await CalendarEntry.find(filter).populate('content').sort({ day: 1 });
  return { entries };
};

const submitRunForApprovalHandler = async ({ user, runId }) => {
  const { submitRunForApproval } = require('../services/autonomousEngineService');
  const { reviewCount, positioned, run } = await submitRunForApproval(runId, user._id);
  const payload = await fetchRunPayload(run);
  return {
    ...payload,
    reviewCount,
    positioned,
    message: `${reviewCount} item${reviewCount === 1 ? '' : 's'} sent to approval queue`,
  };
};

module.exports = {
  fetchRunPayload,
  createAutonomousRun,
  advanceAutonomousRun,
  getAutonomousRun,
  getAutonomousHistory,
  getAutonomousCalendar,
  submitRunForApprovalHandler,
};
