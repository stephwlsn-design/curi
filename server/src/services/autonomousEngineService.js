const AutonomousRun = require('../models/AutonomousRun');
const Workspace = require('../models/Workspace');
const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const Topic = require('../models/Topic');
const { fallbackTopicsFromBrand } = require('./topicDiscoveryService');
const strategyService = require('./strategyService');
const createService = require('./createService');
const designService = require('./designService');
const gemini = require('./geminiService');
const videoService = require('./videoService');
const { scoreCreative } = require('./scoringService');
const { recordInteraction, getTopPreferences } = require('./learningService');
const UserPreferences = require('../models/UserPreferences');
const Strategy = require('../models/Strategy');
const CalendarEntry = require('../models/CalendarEntry');
const { runIdFilter } = require('./approvalService');
const { applyDesignIdeaToDesign } = require('./designService');
const { buildStoredDesignIdeaContext, mergeDesignIdeaSources } = require('../utils/designIdea');
const { compactDesignMetadataForStorage, hydrateDesignContent } = require('../utils/designStorage');
const { designToCanvas, buildCanvasWithDesignIdea } = require('../utils/designCanvas');
const { composeAutonomousPost, extractBriefKeywords, extractPromptThemes } = require('../utils/campaignContent');
const logger = require('../utils/logger');

const PIPELINE_STEPS = [
  'Brand Setup',
  'Topic Discovery',
  'Content Strategy',
  'Content Generation',
  'Creative Generation',
  'Video Generation',
  'Creative Scoring',
  'Approval & Scheduling',
  'Learning Update',
];

const BATCH_PAUSE_MS = process.env.VERCEL ? 0 : 400;
const ITEMS_PER_TICK = process.env.VERCEL ? 15 : 4;
const LOCK_TTL_MS = process.env.VERCEL ? 10_000 : 120_000;
const AUTONOMOUS_MAX_ENTRIES = 30;
const MIN_TOPICS_TO_REUSE = process.env.VERCEL ? 3 : 5;
const STEPS_PER_TICK = process.env.VERCEL ? 6 : 4;
const STALE_STEP_MS = process.env.VERCEL ? 5_000 : 45_000;
const SLOW_STEPS = new Set();
const DESIGN_CAP = process.env.VERCEL ? 10 : 10;
const VIDEO_CAP = process.env.VERCEL ? 3 : 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PLATFORM_ALIASES = {
  linkedin: 'linkedin',
  twitter: 'twitter',
  x: 'twitter',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  youtube: 'youtube',
  email: 'email',
};

const normalizePlatform = (platform) => {
  const key = String(platform || 'linkedin').toLowerCase().replace(/[^a-z]/g, '');
  return PLATFORM_ALIASES[key] || 'universal';
};

const completedStepCount = (run) => run.steps.filter(s => s.status === 'completed').length;

const ensureSteps = (run) => {
  if (!run.steps?.length) {
    run.steps = PIPELINE_STEPS.map((name) => ({ name, status: 'pending' }));
  }
  if (!run.pipelineState) {
    run.pipelineState = { contentIndex: 0, designIndex: 0, videoIndex: 0, designIdeaResolved: false };
  }
};

const runIdOf = (runOrId) => (runOrId?._id ? runOrId._id : runOrId);

const patchAutonomousRun = async (runOrId, mutator) => {
  const id = runIdOf(runOrId);
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const run = await AutonomousRun.findById(id);
    if (!run) return null;
    ensureSteps(run);
    mutator(run);
    try {
      return await run.save();
    } catch (err) {
      const isVersion = err.name === 'VersionError'
        || /No matching document found/i.test(err.message || '');
      if (!isVersion || attempt === MAX_ATTEMPTS - 1) throw err;
      logger.warn(`AutonomousRun save conflict (attempt ${attempt + 1}), retrying…`);
    }
  }
  return null;
};

const setProgress = async (runOrId, completedSteps, stepFraction = 0) => {
  return patchAutonomousRun(runOrId, (run) => {
    const total = PIPELINE_STEPS.length;
    run.progress = Math.min(99, Math.round(((completedSteps + stepFraction) / total) * 100));
  });
};

const updateStep = async (runOrId, stepName, status, summary = null, error = null) => {
  return patchAutonomousRun(runOrId, (run) => {
    const step = run.steps.find(s => s.name === stepName);
    if (step) {
      step.status = status;
      if (status === 'running') step.startedAt = new Date();
      if (status === 'completed' || status === 'failed') step.completedAt = new Date();
      if (summary) step.summary = summary;
      if (error) step.error = error;
    }
    run.progress = Math.round((run.steps.filter(s => s.status === 'completed').length / run.steps.length) * 100);
  });
};

const touchStep = async (runOrId, stepName, summary) => {
  return patchAutonomousRun(runOrId, (run) => {
    const step = run.steps.find(s => s.name === stepName);
    if (step) step.summary = summary;
  });
};

const flushBatchStepProgress = async (runOrId, {
  stepName,
  indexField,
  indexValue,
  statField,
  statValue,
  summary,
  total,
  complete = false,
  completeSummary = null,
}) => {
  return patchAutonomousRun(runOrId, (run) => {
    run.pipelineState[indexField] = complete ? 0 : indexValue;
    run.markModified('pipelineState');
    if (statField) run.stats[statField] = statValue;
    const step = run.steps.find((s) => s.name === stepName);
    if (step) {
      step.summary = complete ? (completeSummary || summary) : summary;
      if (complete) {
        step.status = 'completed';
        step.completedAt = new Date();
      }
    }
    const completedSteps = run.steps.filter((s) => s.status === 'completed').length;
    const stepFraction = complete ? 1 : indexValue / Math.max(total, 1);
    run.progress = complete
      ? Math.round((completedSteps / run.steps.length) * 100)
      : Math.min(99, Math.round(((completedSteps + stepFraction) / PIPELINE_STEPS.length) * 100));
  });
};

const buildFallbackDesign = (entry, brandProfile, stylePref, designIdeaContext = null) => {
  const spec = designIdeaContext?.spec;
  const palette = spec?.colorPalette || brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#FFD154'];
  const headline = entry.topic?.slice(0, 80)
    || entry.caption?.split('\n')[0]?.slice(0, 80)
    || 'Your headline';
  const angleLine = entry.caption?.includes(' — ')
    ? entry.caption.split(' — ').slice(1).join(' — ').slice(0, 120)
    : '';
  const ideaNote = designIdeaContext?.direction?.slice(0, 120);
  return {
    name: `Design — Day ${entry.day}`,
    headline,
    subheadline: angleLine || ideaNote || entry.topic,
    cta: 'Learn more',
    layout: spec?.layout || 'centered',
    typography: spec?.typography || spec?.fontHeadline || `${stylePref} sans-serif`,
    colorPalette: palette.slice(0, 5),
    referenceImageUrl: designIdeaContext?.imageUrl,
    visualElements: ['Brand logo', 'Hero image', 'CTA button'],
    compositionNotes: ideaNote
      ? `Reference aesthetic: ${ideaNote.slice(0, 160)}`
      : 'On-brand layout using campaign content',
    engagementScore: 82,
    brandScore: 88,
    conversionScore: 78,
    platformScore: 80,
    overallScore: 82,
    designIdeaApplied: Boolean(designIdeaContext),
  };
};

const buildFallbackVideo = (entry, brandProfile) => {
  const hook = entry.caption?.split('\n')[0]?.slice(0, 120) || entry.topic;
  const body = entry.caption?.slice(0, 200) || entry.topic;
  return {
    title: `Video — ${entry.topic.slice(0, 40)}`,
    hook,
    scenes: [
      { label: 'Hook', duration: 3, script: hook, visual: 'Bold text on brand background' },
      { label: 'Value', duration: 15, script: body, visual: 'Product demo or b-roll' },
    ],
    cta: 'Visit our site to learn more',
    captions: [hook],
    highlightWords: [],
    musicMood: 'upbeat',
    engagementScore: 80,
    brandScore: 85,
    conversionScore: 75,
    platformScore: 82,
  };
};

const predictPublishTime = (platform, day, baseTime = '09:00') => {
  const offsets = { linkedin: 8, instagram: 11, twitter: 12, tiktok: 18, facebook: 10 };
  const hour = offsets[platform] || parseInt(baseTime.split(':')[0], 10);
  const date = new Date();
  date.setDate(date.getDate() + day);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const acquirePipelineLock = async (runId) => {
  const staleBefore = new Date(Date.now() - LOCK_TTL_MS);
  return AutonomousRun.findOneAndUpdate(
    {
      _id: runId,
      status: { $in: ['queued', 'running'] },
      $or: [
        { processingLockAt: { $exists: false } },
        { processingLockAt: null },
        { processingLockAt: { $lt: staleBefore } },
      ],
    },
    { $set: { processingLockAt: new Date(), status: 'running' } },
    { new: true },
  );
};

const releasePipelineLock = async (runId) => {
  await AutonomousRun.findByIdAndUpdate(runId, { $unset: { processingLockAt: 1 } });
};

const buildInMemoryTopics = (brandProfile = {}, contentPrompt = '') => {
  const briefKeywords = extractBriefKeywords(contentPrompt);
  const seeds = [
    ...(brandProfile.keywords || []),
    brandProfile.industry && `${brandProfile.industry} trends`,
    brandProfile.name && `${brandProfile.name} insights`,
    brandProfile.valueProposition?.slice(0, 60),
    ...briefKeywords.map((k) => `${brandProfile.name || 'Brand'} — ${k}`),
    'Industry news roundup',
    'Customer success story',
    'Product tips and tricks',
    'Behind the brand',
  ].filter(Boolean).map((s) => String(s).trim()).filter((s) => s.length > 3);
  const unique = [...new Set(seeds)].slice(0, 8);
  if (!unique.length) unique.push(`${brandProfile.name || 'Brand'} update`);
  return unique.map((topic, i) => ({ topic, relevance: 90 - i * 3 }));
};

const recoverStaleStepsOnRun = async (runOrId) => {
  return patchAutonomousRun(runOrId, (run) => {
    for (const step of run.steps || []) {
      if (step.status === 'running' && step.startedAt) {
        const age = Date.now() - new Date(step.startedAt).getTime();
        if (age > STALE_STEP_MS) {
          step.status = 'pending';
          step.startedAt = undefined;
          step.summary = undefined;
        }
      }
    }
    run.markModified('steps');
  });
};

const acquirePipelineLockOrSteal = async (runId) => {
  const locked = await acquirePipelineLock(runId);
  if (locked) return locked;

  const existing = await AutonomousRun.findById(runId).lean();
  if (!existing) return null;

  const lockAt = existing.processingLockAt
    ? new Date(existing.processingLockAt).getTime()
    : 0;
  const lockAge = lockAt ? Date.now() - lockAt : Number.POSITIVE_INFINITY;

  // Another advance is still running — never steal an active lock.
  if (lockAge < LOCK_TTL_MS) return null;

  await releasePipelineLock(runId);
  await recoverStaleStepsOnRun(runId);
  return acquirePipelineLock(runId);
};

const buildPipelineContext = async (run) => {
  const workspace = await Workspace.findById(run.workspace);
  const brandProfile = workspace?.brandProfile || {};
  const prefs = await UserPreferences.findOne({ workspace: run.workspace });
  const topPrefs = getTopPreferences(prefs);
  const channels = run.channels.length
    ? run.channels
    : (workspace?.onboarding?.socialChannels || ['linkedin', 'instagram']);
  const stylePref = topPrefs.styles[0]?.name?.toLowerCase() || 'modern';
  const runIdStr = String(run._id);
  const calendarEntries = Math.min(run.days, AUTONOMOUS_MAX_ENTRIES);
  const contentGenCap = calendarEntries;
  return {
    workspace,
    brandProfile,
    topPrefs,
    channels,
    stylePref,
    runIdStr,
    maxEntries: calendarEntries,
    contentGenCap,
  };
};

const generateOnePost = async (run, entry, brandProfile, runIdStr, contentPrompt = '') => {
  const platform = normalizePlatform(entry.platform);
  const brief = contentPrompt?.trim() || '';
  const creativeAngle = entry.angle || entry.caption || '';
  const strategyDriven = Boolean(brief || creativeAngle);
  let generated;

  const useComposed = process.env.VERCEL
    || strategyDriven
    || !gemini.isValidKey(process.env.GEMINI_API_KEY);
  if (useComposed) {
    generated = composeAutonomousPost({
      entry: { ...entry, angle: creativeAngle },
      brandProfile,
      platform,
      campaignBrief: brief,
    });
  } else {
    try {
      generated = await createService.generatePost({
        brandProfile,
        platform,
        topic: entry.topic,
        tone: brandProfile.voice || 'professional',
        type: ['carousel', 'story', 'video', 'reel'].includes(entry.type) ? 'social_post' : (entry.type || 'social_post'),
        campaignBrief: brief,
        creativeAngle,
      });
    } catch (e) {
      logger.warn(`Post AI failed day ${entry.day}, using composed fallback: ${e.message?.slice(0, 80)}`);
      generated = composeAutonomousPost({
        entry: { ...entry, angle: creativeAngle },
        brandProfile,
        platform,
        campaignBrief: brief,
      });
    }
  }

  const content = await Content.create({
    workspace: run.workspace,
    createdBy: run.createdBy,
    type: 'post',
    platform,
    title: entry.topic,
    content: generated.content,
    hashtags: generated.hashtags,
    status: 'draft',
    metadata: { module: 'autonomous', format: entry.type, runId: runIdStr },
    calendarEntry: entry._id,
  });

  entry.content = content._id;
  entry.caption = generated.content;
  entry.status = 'generated';
  await entry.save();
  return content._id;
};

const resolveDesignIdeaForRun = (run, workspaceDesignIdea = null) => {
  const idea = mergeDesignIdeaSources(run.designIdea, workspaceDesignIdea);
  if (!idea?.notes && !idea?.filename && !idea?.imageUrl && !idea?.previewDataUrl
    && !idea?.analyzedDirection && !idea?.analyzedSpec) {
    return null;
  }
  return buildStoredDesignIdeaContext(idea);
};

const advanceAutonomousPipeline = async (runId) => {
  const locked = await acquirePipelineLockOrSteal(runId);
  if (!locked) {
    return { run: await AutonomousRun.findById(runId), busy: true };
  }

  let run = locked;
  ensureSteps(run);
  let sessionTopics = null;

  try {
    for (let tick = 0; tick < STEPS_PER_TICK; tick += 1) {
      run = await AutonomousRun.findById(runId);
      ensureSteps(run);
      await recoverStaleStepsOnRun(runId);
      run = await AutonomousRun.findById(runId);
      ensureSteps(run);

      if (run.status === 'completed' || run.status === 'failed') {
        return { run, busy: false };
      }

      const ctx = await buildPipelineContext(run);
      if (!ctx.workspace) throw new Error('Workspace not found');

      const mergedIdea = mergeDesignIdeaSources(run.designIdea, ctx.workspace.brandProfile?.designIdea);
      if (mergedIdea && JSON.stringify(mergedIdea) !== JSON.stringify(run.designIdea || {})) {
        await patchAutonomousRun(runId, (doc) => {
          doc.designIdea = mergedIdea;
          doc.markModified('designIdea');
        });
        run = await AutonomousRun.findById(runId);
      }

      const currentStep = run.steps.find((s) => s.status === 'running')
        || run.steps.find((s) => s.status === 'pending');

      if (!currentStep) {
        await patchAutonomousRun(runId, (doc) => {
          doc.status = 'completed';
          doc.progress = 100;
          doc.completedAt = new Date();
          doc.label = `${doc.days}-Day Campaign — ${doc.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        });
        return { run: await AutonomousRun.findById(runId), busy: false };
      }

      if (currentStep.status === 'pending') {
        await updateStep(runId, currentStep.name, 'running');
        run = await AutonomousRun.findById(runId);
        ensureSteps(run);
      }

      let stepDone = false;
      const stepName = currentStep.name;

      switch (stepName) {
      case 'Brand Setup': {
        if (!ctx.brandProfile.name && !ctx.workspace.onboarding?.companyName) {
          throw new Error('Complete brand onboarding first — run Discover or set up your brand profile');
        }
        await updateStep(runId, 'Brand Setup', 'completed', `Brand: ${ctx.brandProfile.name || ctx.workspace.onboarding.companyName}`);
        stepDone = true;
        break;
      }
      case 'Topic Discovery': {
        await touchStep(runId, 'Topic Discovery', 'Building topic list from brand profile…');
        if (process.env.VERCEL) {
          sessionTopics = buildInMemoryTopics(ctx.brandProfile, run.contentPrompt);
          fallbackTopicsFromBrand(run.workspace, ctx.brandProfile).catch(() => {});
        } else {
          const topicCount = await Topic.countDocuments({ workspace: run.workspace, status: 'active' });
          if (topicCount >= MIN_TOPICS_TO_REUSE) {
            sessionTopics = await Topic.find({ workspace: run.workspace, status: 'active' })
              .sort({ relevance: -1 }).limit(20).lean();
          } else {
            const topicDiscoveryService = require('./topicDiscoveryService');
            sessionTopics = await topicDiscoveryService.discoverTopics({
              workspaceId: run.workspace,
              brandProfile: ctx.brandProfile,
            });
          }
        }
        await patchAutonomousRun(runId, (doc) => {
          doc.stats.topicsFound = sessionTopics.length;
        });
        await updateStep(runId, 'Topic Discovery', 'completed', `${sessionTopics.length} topics ready`);
        stepDone = true;
        break;
      }
      case 'Content Strategy': {
        if (run.strategy) {
          const planned = await CalendarEntry.countDocuments({ autonomousRun: run._id });
          await updateStep(runId, 'Content Strategy', 'completed', `${planned} calendar entries planned`);
          stepDone = true;
          break;
        }
        await touchStep(runId, 'Content Strategy', `Building ${run.days}-day content plan…`);
        const topics = sessionTopics?.length
          ? sessionTopics
          : await Topic.find({ workspace: run.workspace, status: 'active' }).sort({ relevance: -1 }).limit(20).lean();
        let strategyResult;
        try {
          strategyResult = await strategyService.generateStrategy({
            workspaceId: run.workspace,
            userId: run.createdBy,
            brandProfile: ctx.brandProfile,
            onboarding: ctx.workspace.onboarding,
            topics,
            days: run.days,
            channels: ctx.channels,
            preferences: ctx.topPrefs,
            designIdea: run.designIdea,
            runId: run._id,
            maxEntries: ctx.maxEntries,
            contentPrompt: run.contentPrompt || '',
          });
        } catch (e) {
          logger.error(`Content Strategy failed: ${e.message}`);
          throw e;
        }
        await patchAutonomousRun(runId, (doc) => {
          doc.strategy = strategyResult.strategy._id;
        });
        await updateStep(runId, 'Content Strategy', 'completed', `${strategyResult.entries.length} calendar entries planned`);
        stepDone = true;
        break;
      }
      case 'Content Generation': {
        const entries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
        const postEntries = entries.filter((e) => ['post', 'carousel', 'story', 'social_post', 'reel', 'video', 'ad_creative'].includes(e.type) || !e.type);
        const contentTargets = (postEntries.length ? postEntries : entries).slice(0, ctx.contentGenCap);
        const start = run.pipelineState.contentIndex || 0;
        const end = Math.min(start + ITEMS_PER_TICK, contentTargets.length);

        for (let i = start; i < end; i += 1) {
          try {
            await generateOnePost(run, contentTargets[i], ctx.brandProfile, ctx.runIdStr, run.contentPrompt);
          } catch (e) {
            logger.error(`Content gen failed for day ${contentTargets[i].day}: ${e.message}`);
          }
          if (i + 1 < end) await sleep(BATCH_PAUSE_MS);
        }

        const generated = await Content.countDocuments({
          workspace: run.workspace, type: 'post', 'metadata.runId': ctx.runIdStr,
        });
        const stepComplete = end >= contentTargets.length;
        await flushBatchStepProgress(runId, {
          stepName: 'Content Generation',
          indexField: 'contentIndex',
          indexValue: end,
          statField: 'contentGenerated',
          statValue: generated,
          summary: `Writing posts — ${generated}/${contentTargets.length}`,
          total: contentTargets.length,
          complete: stepComplete,
          completeSummary: `${generated} posts written`,
        });
        if (stepComplete) stepDone = true;
        break;
      }
      case 'Creative Generation': {
        const designIdeaContext = resolveDesignIdeaForRun(run, ctx.workspace.brandProfile?.designIdea);
        run = await AutonomousRun.findById(runId);
        const freshEntries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
        let designSources = freshEntries.filter((e) => e.caption || e.topic);

        if (!designSources.length && run.strategy) {
          const strategy = await Strategy.findById(run.strategy).lean();
          designSources = (strategy?.items || []).map((item) => ({
            topic: item.topic,
            caption: item.angle || item.topic,
            platform: item.channel,
            type: item.format,
            day: item.day,
          }));
        }

        designSources = designSources.slice(0, DESIGN_CAP);
        const start = run.pipelineState.designIndex || 0;
        const end = Math.min(start + ITEMS_PER_TICK, designSources.length);

        for (let i = start; i < end; i += 1) {
          const entry = designSources[i];
          try {
            const platform = normalizePlatform(entry.platform);
            const useDesignIdea = Boolean(designIdeaContext);
            let design;
            if (useDesignIdea || process.env.VERCEL) {
              design = buildFallbackDesign(entry, ctx.brandProfile, ctx.stylePref, designIdeaContext);
            } else {
            try {
              const result = await designService.generateDesigns({
                brandProfile: ctx.brandProfile,
                prompt: entry.caption || entry.topic,
                creativeType: entry.type === 'social_post' ? 'social_post' : (entry.type || 'social_post'),
                channels: [platform === 'universal' ? 'instagram' : platform],
                dimensionId: entry.type === 'story' ? '1080x1920' : '1080x1080',
                variantCount: 1,
                style: ctx.stylePref,
                designIdeaContext,
              });
              design = result.designs[0];
            } catch (e) {
              design = buildFallbackDesign(entry, ctx.brandProfile, ctx.stylePref, designIdeaContext);
            }
            }
            if (!design?.headline) {
              design = buildFallbackDesign(entry, ctx.brandProfile, ctx.stylePref, designIdeaContext);
            }
            design = applyDesignIdeaToDesign(design, designIdeaContext);
            const dimId = entry.type === 'story' ? '1080x1920' : '1080x1080';
            let canvasLayout;
            try {
              canvasLayout = designIdeaContext
                ? buildCanvasWithDesignIdea(design, designIdeaContext, dimId)
                : (design.canvasLayout || designToCanvas(design));
            } catch (canvasErr) {
              logger.warn(`Canvas build failed day ${entry.day}: ${canvasErr.message?.slice(0, 80)}`);
              canvasLayout = designToCanvas(design);
            }
            const compactMeta = compactDesignMetadataForStorage({
              design,
              canvasLayout,
              designIdeaContext,
              runDesignIdea: run.designIdea,
            });
            const score = scoreCreative({ type: 'design', content: design.headline, metadata: design, brandProfile: ctx.brandProfile });
            await Content.create({
              workspace: run.workspace,
              createdBy: run.createdBy,
              type: 'image',
              platform,
              title: design.name || `Design — Day ${entry.day}`,
              content: design.headline,
              metadata: {
                ...compactMeta,
                module: 'autonomous',
                scores: design.scores || score,
                creativeScore: score,
                runId: ctx.runIdStr,
              },
              status: score.publishReady ? 'approved' : 'review',
              calendarEntry: entry._id || undefined,
            });
          } catch (e) {
            logger.error(`Design save failed day ${entry.day}: ${e.message}`);
          }
          if (i + 1 < end) await sleep(BATCH_PAUSE_MS);
        }

        const designCount = await Content.countDocuments({
          workspace: run.workspace,
          type: 'image',
          ...runIdFilter(ctx.runIdStr),
        });
        const designStepComplete = end >= designSources.length;
        const designSummary = designCount > 0
          ? `${designCount} design assets created`
          : 'No calendar items to design — check content strategy step';
        await flushBatchStepProgress(runId, {
          stepName: 'Creative Generation',
          indexField: 'designIndex',
          indexValue: end,
          statField: 'designsGenerated',
          statValue: designCount,
          summary: `Designs — ${end}/${designSources.length}`,
          total: designSources.length,
          complete: designStepComplete,
          completeSummary: designSummary,
        });
        if (designStepComplete) stepDone = true;
        break;
      }
      case 'Video Generation': {
        const entries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
        const videoEntries = entries.filter((e) => ['video', 'reel'].includes(e.type));
        const videoTargets = (videoEntries.length
          ? videoEntries
          : entries.filter((e) => e.caption).slice(0, VIDEO_CAP)).slice(0, VIDEO_CAP);
        const start = run.pipelineState.videoIndex || 0;
        const end = Math.min(start + ITEMS_PER_TICK, videoTargets.length);

        for (let i = start; i < end; i += 1) {
          const entry = videoTargets[i];
          try {
            const platform = normalizePlatform(entry.platform);
            let video;
            if (process.env.VERCEL) {
              video = buildFallbackVideo(entry, ctx.brandProfile);
            } else {
            try {
              const videos = await videoService.generateVideos({
                brandProfile: ctx.brandProfile,
                prompt: entry.caption || entry.topic,
                videoType: entry.type === 'reel' ? 'ugc_style' : 'motion_graphics',
                style: ctx.stylePref,
                variantCount: 1,
                duration: 30,
              });
              video = videos[0];
            } catch (e) {
              video = buildFallbackVideo(entry, ctx.brandProfile);
            }
            }
            const score = scoreCreative({ type: 'video', content: video.hook, metadata: video, brandProfile: ctx.brandProfile });
            await Content.create({
              workspace: run.workspace,
              createdBy: run.createdBy,
              type: 'video',
              platform,
              title: video.title,
              content: video.hook,
              metadata: { ...video, module: 'autonomous', scores: video.scores || score, creativeScore: score, runId: ctx.runIdStr },
              status: score.publishReady ? 'approved' : 'review',
              calendarEntry: entry._id,
            });
          } catch (e) {
            logger.error(`Video save failed day ${entry.day}: ${e.message}`);
          }
          if (i + 1 < end) await sleep(BATCH_PAUSE_MS);
        }

        const videoCount = await Content.countDocuments({
          workspace: run.workspace, type: 'video', 'metadata.runId': ctx.runIdStr,
        });
        const videoStepComplete = end >= videoTargets.length;
        await flushBatchStepProgress(runId, {
          stepName: 'Video Generation',
          indexField: 'videoIndex',
          indexValue: end,
          statField: 'videosGenerated',
          statValue: videoCount,
          summary: `Videos — ${end}/${videoTargets.length}`,
          total: videoTargets.length,
          complete: videoStepComplete,
          completeSummary: `${videoCount} video scripts created`,
        });
        if (videoStepComplete) stepDone = true;
        break;
      }
      case 'Creative Scoring': {
        if (process.env.VERCEL) {
          await Content.updateMany(
            {
              workspace: run.workspace,
              ...runIdFilter(ctx.runIdStr),
              status: { $in: ['draft', 'approved', 'scheduled'] },
            },
            { $set: { status: 'review' } },
          );
          const reviewCount = await Content.countDocuments({
            workspace: run.workspace,
            ...runIdFilter(ctx.runIdStr),
            status: 'review',
          });
          await patchAutonomousRun(runId, (doc) => {
            doc.stats.approved = 0;
          });
          await updateStep(runId, 'Creative Scoring', 'completed', `${reviewCount} assets queued for approval`);
          stepDone = true;
          break;
        }
        const allContent = await Content.find({ workspace: run.workspace, ...runIdFilter(ctx.runIdStr) });
        let approvedCount = 0;
        for (const item of allContent) {
          const score = scoreCreative({
            type: item.type,
            content: item.content,
            metadata: item.metadata,
            brandProfile: ctx.brandProfile,
          });
          item.metadata = { ...(item.metadata?.toObject?.() ?? item.metadata ?? {}), creativeScore: score };
          item.markModified('metadata');
          if (score.publishReady && item.status === 'draft') {
            item.status = 'approved';
            approvedCount++;
          } else if (!score.publishReady && item.status === 'draft') {
            item.status = 'review';
          }
          await item.save();
        }
        await patchAutonomousRun(runId, (doc) => {
          doc.stats.approved = approvedCount;
        });
        await updateStep(runId, 'Creative Scoring', 'completed', `${approvedCount} assets scored above 80`);
        stepDone = true;
        break;
      }
      case 'Approval & Scheduling': {
        const entries = await CalendarEntry.find({ autonomousRun: run._id, content: { $exists: true, $ne: null } })
          .sort({ day: 1 })
          .limit(process.env.VERCEL ? 30 : 999);
        let scheduledCount = 0;

        if (process.env.VERCEL) {
          const entryIds = [];
          for (const entry of entries) {
            if (!entry.content) continue;
            const scheduledAt = predictPublishTime(entry.platform, entry.day, entry.publishTime);
            await Content.findByIdAndUpdate(entry.content, {
              $set: {
                status: 'review',
                'metadata.suggestedScheduledAt': scheduledAt,
                'metadata.suggestedPlatform': entry.platform,
                'metadata.campaignDay': entry.day,
              },
            });
            entryIds.push(entry._id);
            scheduledCount += 1;
          }
          await Content.updateMany(
            {
              workspace: run.workspace,
              ...runIdFilter(ctx.runIdStr),
              type: { $in: ['image', 'video'] },
            },
            { $set: { status: 'review' } },
          );
          if (entryIds.length) {
            await CalendarEntry.updateMany({ _id: { $in: entryIds } }, { $set: { status: 'planned' } });
          }
        } else {
        for (const entry of entries) {
          if (!entry.content) continue;
          const content = await Content.findById(entry.content);
          if (!content || content.status === 'review') continue;
          const scheduledAt = predictPublishTime(entry.platform, entry.day, entry.publishTime);
          content.scheduledAt = scheduledAt;
          content.status = 'scheduled';
          await content.save();
          await PublishJob.create({
            workspace: run.workspace,
            content: content._id,
            platform: entry.platform,
            scheduledAt,
            predictedBestTime: scheduledAt,
            status: 'queued',
            autonomousRun: run._id,
          });
          entry.status = 'scheduled';
          await entry.save();
          scheduledCount++;
        }
        }
        await patchAutonomousRun(runId, (doc) => {
          doc.stats.scheduled = scheduledCount;
        });
        const contentCount = await Content.countDocuments({
          workspace: run.workspace, type: 'post', 'metadata.runId': ctx.runIdStr,
        });
        const designCount = run.stats.designsGenerated || 0;
        const videoCount = run.stats.videosGenerated || 0;
        ctx.workspace.stats.postsGenerated = (ctx.workspace.stats.postsGenerated || 0) + contentCount;
        ctx.workspace.stats.imagesGenerated = (ctx.workspace.stats.imagesGenerated || 0) + designCount;
        ctx.workspace.stats.videosGenerated = (ctx.workspace.stats.videosGenerated || 0) + videoCount;
        await ctx.workspace.save();
        await updateStep(runId, 'Approval & Scheduling', 'completed', process.env.VERCEL
          ? `${scheduledCount} items positioned for approval & scheduling`
          : `${scheduledCount} posts scheduled for publishing`);
        stepDone = true;
        break;
      }
      case 'Learning Update': {
        await recordInteraction({
          workspaceId: run.workspace,
          userId: run.createdBy,
          style: ctx.stylePref,
          format: ctx.topPrefs.formats[0]?.name || 'carousel',
          channel: ctx.channels[0],
        });
        await updateStep(runId, 'Learning Update', 'completed', 'Preferences updated for future campaigns');
        await patchAutonomousRun(runId, (doc) => {
          doc.status = 'completed';
          doc.progress = 100;
          doc.completedAt = new Date();
          doc.label = `${doc.days}-Day Campaign — ${doc.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        });
        logger.info(`Autonomous pipeline completed: run ${runId}`);
        stepDone = true;
        break;
      }
      default:
        stepDone = true;
      }

      if (!stepDone) {
        break;
      }

      run = await AutonomousRun.findById(runId);
      const nextPending = run?.steps?.find((s) => s.status === 'pending');
      if (!nextPending || SLOW_STEPS.has(nextPending.name)) {
        break;
      }
    }

    return { run: await AutonomousRun.findById(runId), busy: false };
  } catch (err) {
    const isVersion = err.name === 'VersionError'
      || /No matching document found/i.test(err.message || '');
    if (isVersion) {
      logger.warn(`Autonomous advance version conflict — returning current state: ${err.message?.slice(0, 120)}`);
      return { run: await AutonomousRun.findById(runId), busy: false };
    }
    logger.error(`Autonomous advance failed: ${err.message}`);
    run = await AutonomousRun.findById(runId);
    if (run && run.status !== 'failed' && run.status !== 'completed') {
      try {
        await patchAutonomousRun(runId, (doc) => {
          doc.status = 'failed';
          doc.error = err.message;
          const activeStep = doc.steps?.find((s) => s.status === 'running');
          if (activeStep) {
            activeStep.status = 'failed';
            activeStep.error = err.message;
            activeStep.completedAt = new Date();
          }
          doc.markModified('steps');
        });
      } catch (saveErr) {
        logger.error(`Could not persist failed run state: ${saveErr.message}`);
      }
    }
    throw err;
  } finally {
    await releasePipelineLock(runId);
  }
};

const runAutonomousPipeline = async ({ runId }) => {
  let safety = 0;
  while (safety++ < 250) {
    const result = await advanceAutonomousPipeline(runId);
    const run = result?.run ?? result;
    if (result?.busy) return run;
    if (!run || run.status === 'completed' || run.status === 'failed') return run;
    const pending = run.steps?.some((s) => s.status !== 'completed');
    if (!pending) return run;
    if (process.env.VERCEL) break;
    await sleep(50);
  }
  return AutonomousRun.findById(runId);
};

const submitRunForApproval = async (runId, userId) => {
  const { submitAutonomousRunForApproval } = require('./approvalService');
  return submitAutonomousRunForApproval({ runId, userId });
};

module.exports = {
  runAutonomousPipeline,
  advanceAutonomousPipeline,
  PIPELINE_STEPS,
  submitRunForApproval,
};
