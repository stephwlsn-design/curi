const AutonomousRun = require('../models/AutonomousRun');
const Workspace = require('../models/Workspace');
const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const Topic = require('../models/Topic');
const topicDiscoveryService = require('./topicDiscoveryService');
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

const CONTENT_CONCURRENCY = 1;
const DESIGN_CAP = 3;
const VIDEO_CAP = 2;
const BATCH_PAUSE_MS = 3500;
const AUTONOMOUS_MAX_ENTRIES = 8;
const MIN_TOPICS_TO_REUSE = 5;

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

const processInBatches = async (items, concurrency, fn, onBatchDone) => {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (onBatchDone) await onBatchDone(i + batch.length, items.length);
    if (i + concurrency < items.length) await sleep(BATCH_PAUSE_MS);
  }
  return results;
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

const runAutonomousPipeline = async ({ runId }) => {
  const run = await AutonomousRun.findById(runId);
  if (!run) throw new Error('Run not found');

  run.status = 'running';
  run.steps = PIPELINE_STEPS.map(name => ({ name, status: 'pending' }));
  await run.save();

  try {
    const workspace = await Workspace.findById(run.workspace);
    const brandProfile = workspace.brandProfile || {};
    const prefs = await UserPreferences.findOne({ workspace: run.workspace });
    const topPrefs = getTopPreferences(prefs);

    // Step 1: Brand Setup
    await updateStep(run, 'Brand Setup', 'running');
    if (!brandProfile.name && !workspace.onboarding?.companyName) {
      throw new Error('Complete brand onboarding first — run Discover or set up your brand profile');
    }
    await updateStep(run, 'Brand Setup', 'completed', `Brand: ${brandProfile.name || workspace.onboarding.companyName}`);

    // Step 2: Topic Discovery
    await updateStep(run, 'Topic Discovery', 'running');
    let topics = await Topic.find({ workspace: run.workspace, status: 'active' })
      .sort({ relevance: -1 }).limit(20);
    if (topics.length < MIN_TOPICS_TO_REUSE) {
      topics = await topicDiscoveryService.discoverTopics({ workspaceId: run.workspace, brandProfile });
    }
    run.stats.topicsFound = topics.length;
    await run.save();
    await updateStep(run, 'Topic Discovery', 'completed', `${topics.length} topics discovered`);

    // Step 3: Content Strategy
    await updateStep(run, 'Content Strategy', 'running');
    const channels = run.channels.length ? run.channels : (workspace.onboarding?.socialChannels || ['linkedin', 'instagram']);
    const maxEntries = Math.min(AUTONOMOUS_MAX_ENTRIES, run.days);
    const { strategy, entries } = await strategyService.generateStrategy({
      workspaceId: run.workspace,
      userId: run.createdBy,
      brandProfile,
      topics,
      days: run.days,
      channels,
      preferences: topPrefs,
      runId: run._id,
      maxEntries,
    });
    run.strategy = strategy._id;
    await run.save();
    await updateStep(run, 'Content Strategy', 'completed', `${entries.length} calendar entries planned`);

    // Step 4: Content Generation
    await updateStep(run, 'Content Generation', 'running', 'Starting post generation...');
    const contentIds = [];
    const stylePref = topPrefs.styles[0]?.name?.toLowerCase() || 'modern';
    const postEntries = entries.filter(e => ['post', 'carousel', 'story', 'social_post', 'reel', 'video', 'ad_creative'].includes(e.type) || !e.type);
    const contentTargets = (postEntries.length ? postEntries : entries).slice(0, maxEntries);
    const doneSteps = completedStepCount(run);

    const runId = String(run._id);

    const generateOnePost = async (entry) => {
      const platform = normalizePlatform(entry.platform);
      let generated;
      try {
        generated = await createService.generatePost({
          brandProfile,
          platform,
          topic: entry.topic,
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

      const content = await Content.create({
        workspace: run.workspace,
        createdBy: run.createdBy,
        type: 'post',
        platform,
        title: entry.topic,
        content: generated.content,
        hashtags: generated.hashtags,
        status: 'draft',
        metadata: { module: 'autonomous', format: entry.type, runId },
        calendarEntry: entry._id,
      });

      entry.content = content._id;
      entry.caption = generated.content;
      entry.status = 'generated';
      await entry.save();
      return content._id;
    };

    await processInBatches(contentTargets, CONTENT_CONCURRENCY, async (entry) => {
      try {
        return await generateOnePost(entry);
      } catch (e) {
        logger.error(`Content gen failed for day ${entry.day}: ${e.message}`);
        return null;
      }
    }, async (done, total) => {
      const generated = contentTargets.filter(e => e.content).length;
      run.stats.contentGenerated = generated;
      await touchStep(run, 'Content Generation', `Writing posts — ${generated}/${total}`);
      await setProgress(run, doneSteps, done / total);
    });

    for (const entry of contentTargets) {
      if (entry.content) contentIds.push(entry.content);
    }
    run.stats.contentGenerated = contentIds.length;
    await run.save();
    await updateStep(run, 'Content Generation', 'completed', `${contentIds.length} posts written`);

    // Step 5: Creative Generation
    await updateStep(run, 'Creative Generation', 'running', 'Generating design assets...');
    let designCount = 0;
    const freshEntries = await CalendarEntry.find({ autonomousRun: run._id }).sort({ day: 1 });
    const designSources = freshEntries.filter(e => e.caption || e.topic).slice(0, DESIGN_CAP);
    const designDoneSteps = completedStepCount(run);

    let designIdeaContext = null;
    if (run.designIdea?.notes || run.designIdea?.filename || run.designIdea?.imageUrl) {
      try {
        designIdeaContext = await designService.resolveDesignIdeaContext(run.designIdea);
        if (designIdeaContext?.direction) {
          run.designIdea.analyzedDirection = designIdeaContext.direction;
          run.designIdea.analyzedSpec = designIdeaContext.spec;
          run.markModified('designIdea');
          await run.save();
          await touchStep(run, 'Creative Generation', 'Applying uploaded design idea...');
        }
      } catch (e) {
        logger.warn(`Design idea analysis failed: ${e.message?.slice(0, 80)}`);
        designIdeaContext = run.designIdea?.notes
          ? { direction: run.designIdea.notes, imagePath: null }
          : null;
      }
    }

    await processInBatches(designSources, 1, async (entry) => {
      try {
        const platform = normalizePlatform(entry.platform);
        let design;
        try {
          const result = await designService.generateDesigns({
            brandProfile,
            prompt: entry.caption || entry.topic,
            creativeType: entry.type === 'social_post' ? 'social_post' : (entry.type || 'social_post'),
            channels: [platform === 'universal' ? 'instagram' : platform],
            dimensionId: entry.type === 'story' ? '1080x1920' : '1080x1080',
            variantCount: 1,
            style: stylePref,
            designIdeaContext,
          });
          design = result.designs[0];
        } catch (e) {
          logger.warn(`Design AI failed, using fallback: ${e.message?.slice(0, 80)}`);
          design = buildFallbackDesign(entry, brandProfile, stylePref, designIdeaContext);
        }

        if (!design?.headline) {
          design = buildFallbackDesign(entry, brandProfile, stylePref, designIdeaContext);
        }

        design = applyDesignIdeaToDesign(design, designIdeaContext);
        const dimId = entry.type === 'story' ? '1080x1920' : '1080x1080';
        const canvasLayout = designIdeaContext?.imageUrl
          ? buildCanvasWithDesignIdea(design, designIdeaContext, dimId)
          : (design.canvasLayout || designToCanvas(design));
        const score = scoreCreative({ type: 'design', content: design.headline, metadata: design, brandProfile });
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
            runId,
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
        return 1;
      } catch (e) {
        logger.error(`Design save failed day ${entry.day}: ${e.message}`);
        return 0;
      }
    }, async (done, total) => {
      const count = await Content.countDocuments({ workspace: run.workspace, type: 'image', 'metadata.runId': runId });
      run.stats.designsGenerated = count;
      await touchStep(run, 'Creative Generation', `Designs — ${done}/${total}`);
      await setProgress(run, designDoneSteps, done / Math.max(total, 1));
    });

    designCount = await Content.countDocuments({ workspace: run.workspace, type: 'image', 'metadata.runId': runId });

    run.stats.designsGenerated = designCount;
    await run.save();
    await updateStep(run, 'Creative Generation', 'completed', `${designCount} design assets created`);

    // Step 6: Video Generation
    await updateStep(run, 'Video Generation', 'running', 'Generating video scripts...');
    let videoCount = 0;
    const videoEntries = entries.filter(e => ['video', 'reel'].includes(e.type));
    const videoTargets = (videoEntries.length ? videoEntries : entries.filter(e => e.caption).slice(0, VIDEO_CAP)).slice(0, VIDEO_CAP);
    const videoDoneSteps = completedStepCount(run);

    await processInBatches(videoTargets, 1, async (entry) => {
      try {
        const platform = normalizePlatform(entry.platform);
        let video;
        try {
          const videos = await videoService.generateVideos({
            brandProfile,
            prompt: entry.caption || entry.topic,
            videoType: entry.type === 'reel' ? 'ugc_style' : 'motion_graphics',
            style: stylePref,
            variantCount: 1,
            duration: 30,
          });
          video = videos[0];
        } catch (e) {
          logger.warn(`Video AI failed, using fallback: ${e.message?.slice(0, 80)}`);
          video = buildFallbackVideo(entry, brandProfile);
        }

        const score = scoreCreative({ type: 'video', content: video.hook, metadata: video, brandProfile });
        await Content.create({
          workspace: run.workspace,
          createdBy: run.createdBy,
          type: 'video',
          platform,
          title: video.title,
          content: video.hook,
          metadata: { ...video, module: 'autonomous', scores: video.scores || score, creativeScore: score, runId },
          status: score.publishReady ? 'approved' : 'review',
          calendarEntry: entry._id,
        });
        return 1;
      } catch (e) {
        logger.error(`Video save failed day ${entry.day}: ${e.message}`);
        return 0;
      }
    }, async (done, total) => {
      const count = await Content.countDocuments({ workspace: run.workspace, type: 'video', 'metadata.runId': runId });
      run.stats.videosGenerated = count;
      await touchStep(run, 'Video Generation', `Videos — ${done}/${total}`);
      await setProgress(run, videoDoneSteps, done / Math.max(total, 1));
    });

    videoCount = await Content.countDocuments({ workspace: run.workspace, type: 'video', 'metadata.runId': runId });

    run.stats.videosGenerated = videoCount;
    await run.save();
    await updateStep(run, 'Video Generation', 'completed', `${videoCount} video scripts created`);

    // Step 7: Creative Scoring
    await updateStep(run, 'Creative Scoring', 'running');
    const allContent = await Content.find({ workspace: run.workspace, 'metadata.runId': runId });
    let approvedCount = 0;

    for (const item of allContent) {
      const score = scoreCreative({
        type: item.type,
        content: item.content,
        metadata: item.metadata,
        brandProfile,
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

    // Step 8: Approval & Scheduling
    await updateStep(run, 'Approval & Scheduling', 'running');
    let scheduledCount = 0;

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

    run.stats.scheduled = scheduledCount;
    workspace.stats.postsGenerated = (workspace.stats.postsGenerated || 0) + contentIds.length;
    workspace.stats.imagesGenerated = (workspace.stats.imagesGenerated || 0) + designCount;
    workspace.stats.videosGenerated = (workspace.stats.videosGenerated || 0) + videoCount;
    await workspace.save();
    await run.save();
    await updateStep(run, 'Approval & Scheduling', 'completed', `${scheduledCount} posts scheduled for publishing`);

    // Step 9: Learning Update
    await updateStep(run, 'Learning Update', 'running');
    await recordInteraction({
      workspaceId: run.workspace,
      userId: run.createdBy,
      style: stylePref,
      format: topPrefs.formats[0]?.name || 'carousel',
      channel: channels[0],
    });
    await updateStep(run, 'Learning Update', 'completed', 'Preferences updated for future campaigns');

    run.status = 'completed';
    run.progress = 100;
    run.completedAt = new Date();
    run.label = `${run.days}-Day Campaign — ${run.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    await run.save();

    logger.info(`Autonomous pipeline completed: run ${runId}`);
    return run;
  } catch (err) {
    logger.error(`Autonomous pipeline failed: ${err.message}`);
    run.status = 'failed';
    run.error = err.message;
    const activeStep = run.steps.find(s => s.status === 'running');
    if (activeStep) await updateStep(run, activeStep.name, 'failed', null, err.message);
    await run.save();
    throw err;
  }
};

module.exports = { runAutonomousPipeline, PIPELINE_STEPS };
