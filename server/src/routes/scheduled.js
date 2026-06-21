const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const Campaign = require('../models/Campaign');
const AutonomousRun = require('../models/AutonomousRun');
const CalendarEntry = require('../models/CalendarEntry');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const detectSource = (content, job, launchContentIds, campaignByContent) => {
  if (job?.autonomousRun) return 'autonomous';
  const meta = content?.metadata || {};
  if (meta.module === 'autonomous' || meta.runId) return 'autonomous';
  if (content?.campaign || launchContentIds.has(String(content?._id))) return 'launch';
  if (campaignByContent.get(String(content?._id))) return 'launch';
  return 'other';
};

const getCreativeScore = (meta = {}) => meta.creativeScore || meta.scores || null;

const formatApproval = (content) => {
  const meta = content?.metadata?.toObject?.() ?? content?.metadata ?? {};
  const score = getCreativeScore(meta);
  const approver = content?.approvedBy;

  if (approver) {
    return {
      type: 'manual',
      name: approver.name || approver.email || 'Team member',
      email: approver.email,
      at: content.approvedAt,
    };
  }

  if (score?.publishReady || ['approved', 'scheduled'].includes(content?.status)) {
    return {
      type: 'auto',
      name: 'Curi Autonomous Engine',
      label: score?.overall ? `Auto-approved · score ${score.overall}` : 'Auto-approved',
      at: content?.updatedAt,
    };
  }

  return null;
};

const formatCreativeSnapshot = (item) => {
  if (!item) return null;
  const meta = item.metadata?.toObject?.() ?? item.metadata ?? {};
  const score = getCreativeScore(meta);

  return {
    _id: item._id,
    type: item.type,
    title: item.title,
    mediaUrl: item.mediaUrl,
    thumbnailUrl: item.thumbnailUrl,
    name: meta.name || item.title,
    headline: meta.headline,
    subheadline: meta.subheadline,
    cta: meta.cta,
    canvasLayout: meta.canvasLayout,
    colorPalette: meta.colorPalette,
    layout: meta.layout,
    dimensions: meta.dimensions,
    referenceImageUrl: meta.referenceImageUrl,
    source: meta.source,
    hook: meta.hook || item.content,
    videoType: meta.videoType,
    scenes: meta.scenes,
    voice: meta.voice,
    creativeScore: score,
    approval: formatApproval(item),
  };
};

const formatPost = (content, job, source, extra = {}) => {
  const meta = content?.metadata?.toObject?.() ?? content?.metadata ?? {};
  const score = getCreativeScore(meta);

  return {
    _id: content?._id,
    jobId: job?._id,
    source,
    type: content?.type,
    platform: job?.platform || content?.platform,
    title: content?.title || meta.headline || meta.name || 'Scheduled post',
    content: content?.content,
    mediaUrl: content?.mediaUrl || content?.thumbnailUrl || meta.referenceImageUrl,
    scheduledAt: job?.scheduledAt || content?.scheduledAt,
    status: job?.status || content?.status,
    campaignName: extra.campaignName,
    runLabel: extra.runLabel,
    runId: job?.autonomousRun?._id || job?.autonomousRun || meta.runId,
    calendarDay: extra.calendarDay,
    calendarEntryId: content?.calendarEntry ? String(content.calendarEntry) : null,
    contentFormat: meta.format || null,
    creativeScore: score,
    approval: formatApproval(content),
    design: extra.design || null,
    video: extra.video || null,
    createdAt: content?.createdAt,
  };
};

router.get('/', async (req, res) => {
  const { workspaceId, source = 'all' } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const contentPopulate = { path: 'approvedBy', select: 'name email' };

  const [jobs, scheduledContent, campaigns, runs] = await Promise.all([
    PublishJob.find({
      workspace: workspaceId,
      status: { $in: ['queued', 'processing'] },
    })
      .populate({ path: 'content', populate: contentPopulate })
      .populate('autonomousRun', 'label days status')
      .sort({ scheduledAt: 1 })
      .limit(100),
    Content.find({
      workspace: workspaceId,
      status: 'scheduled',
    })
      .populate(contentPopulate)
      .sort({ scheduledAt: 1 })
      .limit(100),
    Campaign.find({ workspace: workspaceId }).select('name goal content').lean(),
    AutonomousRun.find({ workspace: workspaceId, createdBy: req.user._id })
      .select('label days status')
      .lean(),
  ]);

  const launchContentIds = new Set();
  const campaignByContent = new Map();
  campaigns.forEach((c) => {
    (c.content || []).forEach((id) => {
      const key = String(id);
      launchContentIds.add(key);
      campaignByContent.set(key, c);
    });
  });

  const calendarEntryIds = new Set();
  const seen = new Set();
  const draftPosts = [];

  for (const job of jobs) {
    if (!job.content) continue;
    const src = detectSource(job.content, job, launchContentIds, campaignByContent);
    if (source !== 'all' && src !== source) continue;

    if (job.content.calendarEntry) calendarEntryIds.add(String(job.content.calendarEntry));

    seen.add(String(job.content._id));
    draftPosts.push({
      content: job.content,
      job,
      src,
      campaign: campaignByContent.get(String(job.content._id)),
      runLabel: job.autonomousRun?.label,
    });
  }

  for (const content of scheduledContent) {
    if (seen.has(String(content._id))) continue;
    const src = detectSource(content, null, launchContentIds, campaignByContent);
    if (source !== 'all' && src !== source) continue;

    if (content.calendarEntry) calendarEntryIds.add(String(content.calendarEntry));

    const runId = content.metadata?.runId;
    let runLabel = null;
    if (runId) {
      const run = runs.find(r => String(r._id) === String(runId));
      runLabel = run?.label;
    }

    draftPosts.push({
      content,
      job: null,
      src,
      campaign: campaignByContent.get(String(content._id)),
      runLabel,
    });
  }

  const relatedCreatives = calendarEntryIds.size
    ? await Content.find({
      calendarEntry: { $in: [...calendarEntryIds] },
      type: { $in: ['image', 'video'] },
    })
      .populate(contentPopulate)
      .lean()
    : [];

  const creativesByEntry = new Map();
  relatedCreatives.forEach((item) => {
    const key = String(item.calendarEntry);
    if (!creativesByEntry.has(key)) creativesByEntry.set(key, {});
    const bucket = creativesByEntry.get(key);
    const snapshot = formatCreativeSnapshot(item);
    if (item.type === 'image') bucket.design = snapshot;
    if (item.type === 'video') bucket.video = snapshot;
  });

  const contentIdsForCalendar = draftPosts
    .filter(p => p.content.calendarEntry || p.job?.autonomousRun)
    .map(p => p.content._id);

  const calendarEntries = contentIdsForCalendar.length
    ? await CalendarEntry.find({ content: { $in: contentIdsForCalendar } }).select('content day topic').lean()
    : [];
  const dayByContent = new Map(calendarEntries.map(e => [String(e.content), e.day]));

  const posts = draftPosts.map(({ content, job, src, campaign, runLabel }) => {
    const entryKey = content.calendarEntry ? String(content.calendarEntry) : null;
    const related = entryKey ? creativesByEntry.get(entryKey) || {} : {};
    const post = formatPost(content, job, src, {
      campaignName: campaign?.name || campaign?.goal?.slice(0, 50),
      runLabel,
      design: related.design || (content.type === 'image' ? formatCreativeSnapshot(content) : null),
      video: related.video || (content.type === 'video' ? formatCreativeSnapshot(content) : null),
    });
    const day = dayByContent.get(String(content._id));
    if (day) post.calendarDay = day;
    return post;
  });

  posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  const counts = {
    all: posts.length,
    launch: posts.filter(p => p.source === 'launch').length,
    autonomous: posts.filter(p => p.source === 'autonomous').length,
    other: posts.filter(p => p.source === 'other').length,
  };

  res.json({ posts, counts, campaigns: campaigns.length, runs: runs.length });
});

router.delete('/:jobId', async (req, res) => {
  const job = await PublishJob.findOne({
    _id: req.params.jobId,
    workspace: req.query.workspaceId,
  });
  if (!job) return res.status(404).json({ error: 'Scheduled job not found' });

  const workspace = await findAccessibleWorkspace(job.workspace, req.user._id);
  if (!workspace) return res.status(403).json({ error: 'Access denied' });

  job.status = 'cancelled';
  await job.save();

  if (job.content) {
    await Content.findByIdAndUpdate(job.content, { status: 'approved', scheduledAt: null });
  }

  res.json({ message: 'Schedule cancelled' });
});

module.exports = router;
