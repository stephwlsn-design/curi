const AutonomousRun = require('../models/AutonomousRun');
const Workspace = require('../models/Workspace');
const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const Topic = require('../models/Topic');
const { fallbackTopicsFromBrand } = require('./topicDiscoveryService');
const strategyService = require('./strategyService');
const createService = require('./createService');
const designService = require('./designService');
const videoService = require('./videoService');
const { scoreCreative } = require('./scoringService');
const { recordInteraction, getTopPreferences } = require('./learningService');
const UserPreferences = require('../models/UserPreferences');
const CalendarEntry = require('../models/CalendarEntry');
const { designToCanvas, buildCanvasWithDesignIdea } = require('../utils/designCanvas');
const { applyDesignIdeaToDesign } = require('./designService');
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

const BATCH_PAUSE_MS = process.env.VERCEL ? 0 : 3500;
const ITEMS_PER_TICK = process.env.VERCEL ? 15 : 99;
const LOCK_TTL_MS = process.env.VERCEL ? 10_000 : 85_000;
const AUTONOMOUS_MAX_ENTRIES = process.env.VERCEL ? 30 : 8;
const MIN_TOPICS_TO_REUSE = process.env.VERCEL ? 3 : 5;
const STEPS_PER_TICK = process.env.VERCEL ? 6 : 1;
const STALE_STEP_MS = process.env.VERCEL ? 8_000 : 30_000;
const SLOW_STEPS = process.env.VERCEL
  ? new Set()
  : new Set(['Content Generation', 'Creative Generation', 'Video Generation', 'Approval & Scheduling']);
const DESIGN_CAP = process.env.VERCEL ? 5 : 3;
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

const setProgress = async (run, completedSteps, stepFraction = 0) => {
  const total = PIPELINE_STEPS.length;
  run.progress = Math.min(99, Math.round(((completedSteps + stepFraction) / total) * 100));
  await run.save();
};

const updateStep = async (run, stepName, status, summary = null, error = null) => {
  const step = run.steps.find(s => s.name === stepName);
  if (step) {
    step.status = status;
    if (status === 'running') step.startedAt = new Date();
    if (status === 'completed' || status === 'failed') step.completedAt = new Date();
    if (summary) step.summary = summary;
    if (error) step.error = error;
  }
  const completed = run.steps.filter(s => s.status === 'completed').length;
  run.progress = Math.round((completed / run.steps.length) * 100);
  await run.save();
};

const touchStep = async (run, stepName, summary) => {
  const step = run.steps.find(s => s.name === stepName);
  if (step) step.summary = summary;
  await run.save();
};

const buildFallbackDesign = (entry, brandProfile, stylePref, designIdeaContext = null) => {
  const palette = designIdeaContext?.spec?.colorPalette || brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#FFD154'];
  const headline = entry.caption?.split('\n')[0]?.slice(0, 80) || entry.topic;
  const ideaNote = designIdeaContext?.direction?.slice(0, 120);
  return {
    name: `Design — Day ${entry.day}`,
    headline,
    subheadline: ideaNote || entry.topic,
    cta: 'Learn more',
    layout: designIdeaContext?.spec?.layout || 'centered',
    typography: designIdeaContext?.spec?.typography || `${stylePref} sans-serif`,
    colorPalette: palette.slice(0, 3),
    referenceImageUrl: designIdeaContext?.imageUrl,
    visualElements: ['Brand logo', 'Hero image', 'CTA button'],
    compositionNotes: designIdeaContext?.direction
      ? `Based on uploaded reference: ${designIdeaContext.direction.slice(0, 160)}`
      : 'On-brand layout using saved content',
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
  return {
    title: `Video — ${entry.topic.slice(0, 40)}`,
    hook,
    scenes: [
      { label: 'Hook', duration: 3, script: hook, visual: 'Bold text on brand background' },
      { label: 'Value', duration: 15, script: entry.caption?.slice(0, 200) || entry.topic, visual: 'Product demo or b-roll' },
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

const ensureSteps = (run) => {
  if (!run.steps?.length) {
    run.steps = PIPELINE_STEPS.map((name) => ({ name, status: 'pending' }));
  }
  if (!run.pipelineState) {
    run.pipelineState = { contentIndex: 0, designIndex: 0, videoIndex: 0, designIdeaResolved: false };
  }
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

const buildInMemoryTopics = (brandProfile = {}) => {
  const seeds = [
    ...(brandProfile.keywords || []),
    brandProfile.industry && `${brandProfile.industry} trends`,
    brandProfile.name && `${brandProfile.name} insights`,
    brandProfile.valueProposition?.slice(0, 60),
    'Industry news roundup',
    'Customer success story',
    'Product tips and tricks',
    'Behind the brand',
  ].filter(Boolean).map((s) => String(s).trim()).filter((s) => s.length > 3);
  const unique = [...new Set(seeds)].slice(0, 8);
  if (!unique.length) unique.push(`${brandProfile.name || 'Brand'} update`);
  return unique.map((topic, i) => ({ topic, relevance: 90 - i * 3 }));
};

const recoverStaleStepsOnRun = async (run) => {
  let changed = false;
  for (const step of run.steps || []) {
    if (step.status === 'running' && step.startedAt) {
      const age = Date.now() - new Date(step.startedAt).getTime();
      if (age > STALE_STEP_MS) {
        step.status = 'pending';
        step.startedAt = undefined;
        step.summary = undefined;
        changed = true;
      }
    }
  }
  if (changed) {
    run.markModified('steps');
    await run.save();
  }
};

const acquirePipelineLockOrSteal = async (runId) => {
  let locked = await acquirePipelineLock(runId);
  if (locked) return locked;
  await releasePipelineLock(runId);
  const run = await AutonomousRun.findById(runId);
  if (run) await recoverStaleStepsOnRun(run);
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
  const calendarEntries = process.env.VERCEL
    ? Math.min(run.days, 30)
    : Math.min(AUTONOMOUS_MAX_ENTRIES, run.days);
  const contentGenCap = process.env.VERCEL ? calendarEntries : Math.min(AUTONOMOUS_MAX_ENTRIES, run.days);
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
  let generated;
  const direction = contentPrompt?.trim();
  if (process.env.VERCEL) {
    const anglePart = entry.caption?.includes(' — ')
      ? entry.caption.split(' — ').slice(1).join(' — ')
      : (entry.caption && entry.caption !== entry.topic ? entry.caption : '');
    const parts = [entry.topic, anglePart || direction || brandProfile.valueProposition || 'Discover how we help brands grow with AI-powered marketing.'];
    if (direction && !anglePart?.includes(direction.slice(0, 20))) {
      parts.push(`Campaign focus: ${direction}`);
    }
    generated = {
      content: parts.filter(Boolean).join('\n\n'),
      hashtags: (brandProfile.keywords || []).slice(0, 5),
    };
  } else {
    try {
      generated = await createService.generatePost({
        brandProfile,
        platform,
        topic: entry.caption && entry.caption !== entry.topic
          ? entry.caption
          : entry.topic,
        tone: brandProfile.voice || 'professional',
        type: ['carousel', 'story', 'video', 'reel'].includes(entry.type) ? 'social_post' : (entry.type || 'social_post'),
      });
    } catch (e) {
      logger.warn(`Post AI failed day ${entry.day}, using topic fallback: ${e.message?.slice(0, 80)}`);
      generated = {
        content: `${entry.topic}\n\n${brandProfile.valueProposition || 'Discover how we help brands grow with AI-powered marketing.'}`,
        hashtags: (brandProfile.keywords || []).slice(0, 5),
      };
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

const resolveDesignIdeaForRun = async (run) => {
  if (run.pipelineState?.designIdeaResolved) return null;
  let designIdeaContext = null;
  if (process.env.VERCEL) {
    designIdeaContext = run.designIdea?.notes || run.designIdea?.imageUrl
      ? { direction: run.designIdea.notes || '', imageUrl: run.designIdea.imageUrl, imagePath: null }
      : null;
  } else if (run.designIdea?.notes || run.designIdea?.filename || run.designIdea?.imageUrl) {
    try {
      designIdeaContext = await designService.resolveDesignIdeaContext(run.designIdea);
      if (designIdeaContext?.direction) {
        run.designIdea.analyzedDirection = designIdeaContext.direction;
        run.designIdea.analyzedSpec = designIdeaContext.spec;
        run.markModified('designIdea');
      }
    } catch (e) {
      logger.warn(`Design idea analysis failed: ${e.message?.slice(0, 80)}`);
      designIdeaContext = run.designIdea?.notes
        ? { direction: run.designIdea.notes, imagePath: null }
        : null;
    }
  }
  run.pipelineState.designIdeaResolved = true;
  run.markModified('pipelineState');
  await run.save();
  return designIdeaContext;
};

const advanceAutonomousPipeline = async (runId) => {
  const locked = await acquirePipelineLockOrSteal(runId);
  if (!locked) {
    return AutonomousRun.findById(runId);
  }

  let run = locked;
  ensureSteps(run);
  let sessionTopics = null;

  try {
    for (let tick = 0; tick < STEPS_PER_TICK; tick += 1) {
      run = await AutonomousRun.findById(runId);
      ensureSteps(run);
      await recoverStaleStepsOnRun(run);
      run = await AutonomousRun.findById(runId);
      ensureSteps(run);

      if (run.status === 'completed' || run.status === 'failed') {
        return run;
      }

      const ctx = await buildPipelineContext(run);
      if (!ctx.workspace) throw new Error('Workspace not found');

      const currentStep = run.steps.find((s) => s.status === 'running')
        || run.steps.find((s) => s.status === 'pending');

      if (!currentStep) {
        run.status = 'completed';
        run.progress = 100;
        run.completedAt = new Date();
        run.label = `${run.days}-Day Campaign — ${run.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        await run.save();
        return run;
      }

      if (currentStep.status === 'pending') {
        await updateStep(run, currentStep.name, 'running');
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
        await updateStep(run, 'Brand Setup', 'completed', `Brand: ${ctx.brandProfile.name || ctx.workspace.onboarding.companyName}`);
        stepDone = true;
        break;
      }
      case 'Topic Discovery': {
        await touchStep(run, 'Topic Discovery', 'Building topic list from brand profile…');
        if (process.env.VERCEL) {
          sessionTopics = buildInMemoryTopics(ctx.brandProfile);
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
        run.stats.topicsFound = sessionTopics.length;
        await run.save();
        await updateStep(run, 'Topic Discovery', 'completed', `${sessionTopics.length} topics ready`);
        stepDone = true;
        break;
      }
      case 'Content Strategy': {
        await touchStep(run, 'Content Strategy', `Building ${run.days}-day content plan…`);
        const topics = sessionTopics?.length
          ? sessionTopics
          : await Topic.find({ workspace: run.workspace, status: 'active' }).sort({ relevance: -1 }).limit(20).lean();
        const { strategy, entries } = await strategyService.generateStrategy({
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
        run.strategy = strategy._id;
        await run.save();
        await updateStep(run, 'Content Strategy', 'completed', `${entries.length} calendar entries planned`);
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

        run.pipelineState.contentIndex = end;
        run.markModified('pipelineState');
        const generated = await Content.countDocuments({
          workspace: run.workspace, type: 'post', 'metadata.runId': ctx.runIdStr,
        });
        run.stats.contentGenerated = generated;
        await touchStep(run, 'Content Generation', `Writing posts — ${generated}/${contentTargets.length}`);
        await setProgress(run, completedStepCount(run), end / Math.max(contentTargets.length, 1));

        if (end >= contentTargets.length) {
          await updateStep(run, 'Content Generation', 'completed', `${generated} posts written`);
          run.pipelineState.contentIndex = 0;
          run.markModified('pipelineState');
          await run.save();
          stepDone = true;
        }
        break;
      }
      case 'Creative Generation': {
        const designIdeaContext = await resolveDesignIdeaForRun(run);
        run = await AutonomousRun.findById(runId);
        const freshEntries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
        const designSources = freshEntries.filter((e) => e.caption || e.topic).slice(0, DESIGN_CAP);
        const start = run.pipelineState.designIndex || 0;
        const end = Math.min(start + ITEMS_PER_TICK, designSources.length);

        for (let i = start; i < end; i += 1) {
          const entry = designSources[i];
          try {
            const platform = normalizePlatform(entry.platform);
            let design;
            if (process.env.VERCEL) {
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
            const canvasLayout = designIdeaContext?.imageUrl
              ? buildCanvasWithDesignIdea(design, designIdeaContext, dimId)
              : (design.canvasLayout || designToCanvas(design));
            const score = scoreCreative({ type: 'design', content: design.headline, metadata: design, brandProfile: ctx.brandProfile });
            await Content.create({
              workspace: run.workspace,
              createdBy: run.createdBy,
              type: 'image',
              platform,
              title: design.name || `Design — Day ${entry.day}`,
              content: design.headline,
              metadata: {
                ...design,
                module: 'autonomous',
                canvasLayout,
                scores: design.scores || score,
                creativeScore: score,
                runId: ctx.runIdStr,
                designIdea: run.designIdea?.notes || run.designIdea?.imageUrl ? {
                  notes: run.designIdea.notes,
                  imageUrl: run.designIdea.imageUrl,
                  referenceImageUrl: designIdeaContext?.imageUrl,
                } : undefined,
                referenceImageUrl: design.referenceImageUrl || designIdeaContext?.imageUrl,
              },
              status: score.publishReady ? 'approved' : 'review',
              calendarEntry: entry._id,
            });
          } catch (e) {
            logger.error(`Design save failed day ${entry.day}: ${e.message}`);
          }
          if (i + 1 < end) await sleep(BATCH_PAUSE_MS);
        }

        run.pipelineState.designIndex = end;
        run.markModified('pipelineState');
        const designCount = await Content.countDocuments({
          workspace: run.workspace, type: 'image', 'metadata.runId': ctx.runIdStr,
        });
        run.stats.designsGenerated = designCount;
        await touchStep(run, 'Creative Generation', `Designs — ${end}/${designSources.length}`);
        await setProgress(run, completedStepCount(run), end / Math.max(designSources.length, 1));

        if (end >= designSources.length) {
          await updateStep(run, 'Creative Generation', 'completed', `${designCount} design assets created`);
          run.pipelineState.designIndex = 0;
          run.markModified('pipelineState');
          await run.save();
          stepDone = true;
        }
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

        run.pipelineState.videoIndex = end;
        run.markModified('pipelineState');
        const videoCount = await Content.countDocuments({
          workspace: run.workspace, type: 'video', 'metadata.runId': ctx.runIdStr,
        });
        run.stats.videosGenerated = videoCount;
        await touchStep(run, 'Video Generation', `Videos — ${end}/${videoTargets.length}`);
        await setProgress(run, completedStepCount(run), end / Math.max(videoTargets.length, 1));

        if (end >= videoTargets.length) {
          await updateStep(run, 'Video Generation', 'completed', `${videoCount} video scripts created`);
          run.pipelineState.videoIndex = 0;
          run.markModified('pipelineState');
          await run.save();
          stepDone = true;
        }
        break;
      }
      case 'Creative Scoring': {
        if (process.env.VERCEL) {
          await Content.updateMany(
            {
              workspace: run.workspace,
              'metadata.runId': ctx.runIdStr,
              status: { $in: ['draft', 'approved', 'scheduled'] },
            },
            { $set: { status: 'review' } },
          );
          const reviewCount = await Content.countDocuments({
            workspace: run.workspace,
            'metadata.runId': ctx.runIdStr,
            status: 'review',
          });
          run.stats.approved = 0;
          await run.save();
          await updateStep(run, 'Creative Scoring', 'completed', `${reviewCount} assets queued for approval`);
          stepDone = true;
          break;
        }
        const allContent = await Content.find({ workspace: run.workspace, 'metadata.runId': ctx.runIdStr });
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
        run.stats.approved = approvedCount;
        await run.save();
        await updateStep(run, 'Creative Scoring', 'completed', `${approvedCount} assets scored above 80`);
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
              'metadata.runId': ctx.runIdStr,
              type: { $in: ['image', 'video'] },
            },
            { $set: { status: 'review' } },
          );
          if (entryIds.length) {
            await CalendarEntry.updateMany({ _id: { $in: entryIds } }, { $set: { status: 'planned' } });
          }
          run.stats.scheduled = 0;
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
        run.stats.scheduled = scheduledCount;
        const contentCount = await Content.countDocuments({
          workspace: run.workspace, type: 'post', 'metadata.runId': ctx.runIdStr,
        });
        const designCount = run.stats.designsGenerated || 0;
        const videoCount = run.stats.videosGenerated || 0;
        ctx.workspace.stats.postsGenerated = (ctx.workspace.stats.postsGenerated || 0) + contentCount;
        ctx.workspace.stats.imagesGenerated = (ctx.workspace.stats.imagesGenerated || 0) + designCount;
        ctx.workspace.stats.videosGenerated = (ctx.workspace.stats.videosGenerated || 0) + videoCount;
        await ctx.workspace.save();
        await run.save();
        await updateStep(run, 'Approval & Scheduling', 'completed', process.env.VERCEL
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
        await updateStep(run, 'Learning Update', 'completed', 'Preferences updated for future campaigns');
        run.status = 'completed';
        run.progress = 100;
        run.completedAt = new Date();
        run.label = `${run.days}-Day Campaign — ${run.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        await run.save();
        logger.info(`Autonomous pipeline completed: run ${runId}`);
        stepDone = true;
        break;
      }
      default:
        stepDone = true;
      }

      if (!stepDone) {
        await run.save();
        break;
      }

      run = await AutonomousRun.findById(runId);
      const nextPending = run?.steps?.find((s) => s.status === 'pending');
      if (!nextPending || SLOW_STEPS.has(nextPending.name)) {
        break;
      }
    }

    return AutonomousRun.findById(runId);
  } catch (err) {
    logger.error(`Autonomous advance failed: ${err.message}`);
    run = await AutonomousRun.findById(runId);
    if (run && run.status !== 'failed' && run.status !== 'completed') {
      run.status = 'failed';
      run.error = err.message;
      const activeStep = run.steps?.find((s) => s.status === 'running');
      if (activeStep) {
        activeStep.status = 'failed';
        activeStep.error = err.message;
        activeStep.completedAt = new Date();
        run.markModified('steps');
      }
      await run.save();
    }
    throw err;
  } finally {
    await releasePipelineLock(runId);
  }
};

const runAutonomousPipeline = async ({ runId }) => {
  let safety = 0;
  while (safety++ < 250) {
    const run = await advanceAutonomousPipeline(runId);
    if (!run || run.status === 'completed' || run.status === 'failed') return run;
    const pending = run.steps?.some((s) => s.status !== 'completed');
    if (!pending) return run;
    if (process.env.VERCEL) break;
    await sleep(50);
  }
  return AutonomousRun.findById(runId);
};

const submitRunForApproval = async (runId, userId) => {
  const run = await AutonomousRun.findOne({ _id: runId, createdBy: userId });
  if (!run) {
    const err = new Error('Run not found');
    err.status = 404;
    throw err;
  }

  const runIdStr = String(run._id);
  const entries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
  let positioned = 0;

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
    positioned += 1;
  }

  await Content.updateMany(
    {
      workspace: run.workspace,
      'metadata.runId': runIdStr,
      status: { $nin: ['published', 'review'] },
    },
    { $set: { status: 'review' } },
  );

  const reviewCount = await Content.countDocuments({
    workspace: run.workspace,
    'metadata.runId': runIdStr,
    status: 'review',
  });

  const scoringStep = run.steps?.find((s) => s.name === 'Creative Scoring');
  if (scoringStep && scoringStep.status !== 'completed') {
    scoringStep.status = 'completed';
    scoringStep.completedAt = new Date();
    scoringStep.summary = `${reviewCount} assets queued for approval`;
  }

  const approvalStep = run.steps?.find((s) => s.name === 'Approval & Scheduling');
  if (approvalStep && approvalStep.status !== 'completed') {
    approvalStep.status = 'completed';
    approvalStep.completedAt = new Date();
    approvalStep.summary = `${positioned || reviewCount} items positioned for approval & scheduling`;
  }

  run.stats.approved = 0;
  run.stats.scheduled = 0;
  run.markModified('steps');
  await run.save();

  return { reviewCount, positioned, run };
};

module.exports = {
  runAutonomousPipeline,
  advanceAutonomousPipeline,
  PIPELINE_STEPS,
  submitRunForApproval,
};
