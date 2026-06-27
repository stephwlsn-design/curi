const Content = require('../models/Content');
const Campaign = require('../models/Campaign');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const logger = require('../utils/logger');
const { generateJSON, generateText } = require('./llmService');
const { listAccountsForUser } = require('./socialAccountService');

const ALL_PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook'];
const IMAGE_PLATFORMS = new Set(['instagram', 'facebook']);
const BATCH_SIZE = 4;
const LAUNCH_TIMEOUT_MS = process.env.VERCEL ? 45_000 : 90_000;
const LAUNCH_TOPICS_TIMEOUT_MS = process.env.VERCEL ? 8_000 : 12_000;
const LAUNCH_STEP_TIMEOUT_MS = process.env.VERCEL ? 14_000 : 25_000;

const planPostCount = (platforms, hasSourceContent) => {
  const perPlatform = 2;
  const count = Math.max(platforms.length, platforms.length * perPlatform);
  return Math.min(count, hasSourceContent ? 6 : 8);
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const generatePostsBatch = async ({ brandProfile, assignments, tone, goal }) => {
  if (!assignments.length) return [];

  const data = await generateJSON({
    label: 'LaunchPosts',
    system: 'You are a world-class social media strategist. Return ONLY valid JSON.',
    user: `Brand: ${brandProfile.name || 'startup'}. Industry: ${brandProfile.industry || 'tech'}. Voice: ${tone || brandProfile.voice || 'professional'}. Campaign goal: ${goal}.

Generate exactly ${assignments.length} platform-native social posts as JSON:
{ "posts": [{ "platform": "linkedin", "content": "post text", "hashtags": ["tag1"] }] }

Assignments:
${assignments.map((a, i) => `${i + 1}. [${a.platform}] Topic: ${a.topic}`).join('\n')}

Each post must match its platform character limits and style. Hashtags without # prefix.`,
    timeoutMs: LAUNCH_TIMEOUT_MS,
  });

  return (data.posts || []).map((post, i) => ({
    platform: post.platform || assignments[i]?.platform,
    content: post.content || post.text || '',
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
  })).filter((p) => p.content?.trim());
};

const finalizeCampaignPosts = async ({
  campaignId, workspaceId, userId, goal, contentIds, startDate, endDate,
}) => {
  if (!contentIds.length) return;

  const msPerDay = (endDate - startDate) / Math.max(contentIds.length, 1);
  await Promise.all(contentIds.map((id, index) => {
    const scheduledAt = new Date(startDate.getTime() + msPerDay * (index + 1));
    if (index === 0 && startDate > new Date()) {
      scheduledAt.setTime(startDate.getTime());
    } else {
      scheduledAt.setHours(9, 0, 0, 0);
    }
    return Content.findByIdAndUpdate(id, {
      $set: {
        status: 'review',
        'metadata.suggestedScheduledAt': scheduledAt,
        'metadata.campaignId': String(campaignId),
        'metadata.campaignGoal': goal,
        'metadata.module': 'launch',
      },
    });
  }));
};

const scheduleLaunchCampaignPosts = async ({ campaignId, workspaceId, userId, contentIds }) => {
  const { scheduleContent: enqueueSchedule } = require('./designUploadService');
  const ids = contentIds || [];
  if (!ids.length) return { scheduled: 0, total: 0, errors: [] };

  const items = await Content.find({ _id: { $in: ids } })
    .sort({ 'metadata.suggestedScheduledAt': 1 });

  let scheduled = 0;
  const errors = [];
  for (const item of items) {
    if (['published', 'scheduled'].includes(item.status)) continue;
    const when = item.metadata?.suggestedScheduledAt || item.scheduledAt;
    if (!when) continue;
    try {
      await enqueueSchedule({
        content: item,
        platform: item.platform,
        scheduledAt: when,
        workspaceId,
        userId,
      });
      scheduled += 1;
    } catch (err) {
      errors.push({ contentId: item._id, error: err.message });
    }
  }

  if (scheduled > 0) {
    await Campaign.findByIdAndUpdate(campaignId, { status: 'active' });
  }

  return { scheduled, total: items.length, errors };
};

const scheduleLaunchCampaign = async ({ campaignId, userId, workspaceId, scheduleStartAt }) => {
  const campaign = await Campaign.findOne({ _id: campaignId, createdBy: userId });
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }

  const contentIds = (campaign.content || []).filter(Boolean);
  if (!contentIds.length) {
    const err = new Error('Campaign has no content to schedule');
    err.status = 400;
    throw err;
  }

  if (scheduleStartAt) {
    const startDate = new Date(scheduleStartAt);
    if (Number.isNaN(startDate.getTime())) {
      const err = new Error('Invalid schedule date');
      err.status = 400;
      throw err;
    }
    if (startDate <= new Date()) {
      const err = new Error('Schedule date must be in the future');
      err.status = 400;
      throw err;
    }
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(campaign.timeline || 30));
    await finalizeCampaignPosts({
      campaignId,
      workspaceId: workspaceId || campaign.workspace,
      userId,
      goal: campaign.goal,
      contentIds,
      startDate,
      endDate,
    });
    campaign.scheduleMode = 'scheduled';
    campaign.scheduledLaunchAt = startDate;
    campaign.startDate = startDate;
    campaign.endDate = endDate;
    await campaign.save();
  }

  const result = await scheduleLaunchCampaignPosts({
    campaignId,
    workspaceId: workspaceId || campaign.workspace,
    userId,
    contentIds,
  });

  const updated = await Campaign.findById(campaignId).populate('content').lean();
  return { ...result, campaign: updated };
};

const resolvePlatforms = (requested, user, workspace) => {
  const connected = new Set(
    listAccountsForUser(user).filter((a) => a.connected).map((a) => a.platform),
  );
  const preferred = workspace?.onboarding?.socialChannels?.length
    ? workspace.onboarding.socialChannels.map((p) => (p === 'x' ? 'twitter' : p))
    : ALL_PLATFORMS;

  let candidates = (requested?.length ? requested : preferred).filter((p) => ALL_PLATFORMS.includes(p));
  if (!candidates.length) candidates = [...ALL_PLATFORMS];

  const connectedCandidates = candidates.filter((p) => connected.has(p));
  return connectedCandidates.length ? connectedCandidates : candidates;
};

const PLATFORM_LABELS = {
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const formatPlatformList = (platforms) => (
  (platforms || []).map((p) => PLATFORM_LABELS[p] || p).join(', ')
);

const getLaunchIntegrationStatus = (user, platforms) => {
  const connectedSet = new Set(
    listAccountsForUser(user).filter((a) => a.connected).map((a) => a.platform),
  );
  const required = (platforms || []).filter((p) => ALL_PLATFORMS.includes(p));
  const missing = required.filter((p) => !connectedSet.has(p));
  return {
    required,
    connected: required.filter((p) => connectedSet.has(p)),
    missing,
    ready: missing.length === 0,
  };
};

const loadSourceAssets = async ({ workspaceId, sourceContentId, designIds }) => {
  let sourceContent = null;
  const designs = [];

  if (sourceContentId) {
    sourceContent = await Content.findOne({ _id: sourceContentId, workspace: workspaceId, type: 'post' });
  }

  if (designIds?.length) {
    const items = await Content.find({
      _id: { $in: designIds },
      workspace: workspaceId,
      type: 'image',
    });
    designs.push(...items);
    if (!items.length) {
      const fallback = await Content.find({
        _id: { $in: designIds },
        workspace: workspaceId,
      });
      designs.push(...fallback.filter((d) => d.metadata?.module === 'design' || d.metadata?.canvasLayout));
    }
  }

  return { sourceContent, designs };
};

const designMediaUrl = (design) => design?.thumbnailUrl || design?.mediaUrl
  || design?.metadata?.thumbnailUrl || design?.metadata?.mediaUrl || null;

const pickDesignCopy = (design, goal) => {
  const candidates = [
    design?.content,
    design?.metadata?.headline,
    design?.title,
    design?.metadata?.subheadline,
    goal,
  ];
  return candidates.find((t) => typeof t === 'string' && t.trim())?.trim() || goal;
};

const seedPostsFromDesigns = async ({
  designs, platforms, workspaceId, userId, campaignId, goal,
}) => {
  if (!designs.length) return [];

  const ids = [];
  for (let i = 0; i < designs.length; i += 1) {
    const design = designs[i];
    const platform = platforms[i % platforms.length];
    const copy = pickDesignCopy(design, goal);
    const mediaUrl = designMediaUrl(design);

    const post = await Content.create({
      workspace: workspaceId,
      createdBy: userId,
      type: 'post',
      platform,
      content: copy,
      hashtags: [],
      mediaUrl: IMAGE_PLATFORMS.has(platform) ? mediaUrl : (mediaUrl || undefined),
      thumbnailUrl: mediaUrl || undefined,
      campaign: campaignId,
      status: 'draft',
      metadata: {
        module: 'launch',
        campaignId: String(campaignId),
        campaignGoal: goal,
        designId: design._id ? String(design._id) : undefined,
      },
    });
    ids.push(post._id);
  }
  return ids;
};

const buildInstantTopics = (count, seedTopic, goal) => (
  Array.from({ length: count }, (_, i) => `${seedTopic || goal} — angle ${i + 1}`)
);

const buildLaunchProgressMessage = (campaign, integrationStatus) => {
  const phase = campaign?.metadata?.launchPhase || 'init';
  const count = Array.isArray(campaign?.content) ? campaign.content.length : 0;
  const assignments = campaign?.metadata?.assignments || [];
  const index = campaign?.metadata?.assignmentIndex || 0;
  const platforms = campaign?.platforms || [];
  const platformNames = formatPlatformList(platforms);

  if (phase === 'init') {
    return count
      ? `Loaded ${count} post${count === 1 ? '' : 's'} from your Create & Design assets`
      : 'Setting up your campaign…';
  }
  if (phase === 'topics') return 'Planning post topics for your channels…';
  if (phase === 'posts') {
    if (assignments.length) {
      return `Writing posts (${Math.min(index, assignments.length)} of ${assignments.length}) for ${platformNames || 'your channels'}…`;
    }
    return count
      ? `Writing additional posts (${count} created)…`
      : 'Creating your first posts…';
  }
  if (phase === 'strategy') return 'Building your publishing plan…';
  if (phase === 'finalize') return 'Scheduling posts and wrapping up…';
  if (phase === 'done') {
    return count
      ? `${count} post${count === 1 ? '' : 's'} ready for ${integrationStatus?.ready ? 'approval' : 'review'}`
      : 'Launch finished';
  }
  return count ? `${count} posts generated so far…` : 'Starting launch…';
};

const createFallbackPost = async ({
  assignment, goal, design, workspaceId, userId, campaignId,
}) => {
  const platform = assignment.platform;
  const mediaUrl = design ? designMediaUrl(design) : null;
  const copy = `${assignment.topic}\n\n${goal}`.slice(0, 2800);

  return Content.create({
    workspace: workspaceId,
    createdBy: userId,
    type: 'post',
    platform,
    content: copy,
    hashtags: [],
    mediaUrl: IMAGE_PLATFORMS.has(platform) ? mediaUrl : (mediaUrl || undefined),
    thumbnailUrl: mediaUrl || undefined,
    campaign: campaignId,
    status: 'draft',
    metadata: {
      module: 'launch',
      campaignId: String(campaignId),
      campaignGoal: goal,
      designId: design?._id ? String(design._id) : undefined,
      fallback: true,
    },
  });
};

const generatePostsForBatch = async ({
  batch, brandProfile, goal, designs, workspaceId, userId, campaignId, contentIds,
}) => {
  const ids = [...contentIds];
  try {
    const generated = await generatePostsBatch({
      brandProfile,
      assignments: batch,
      tone: brandProfile.voice || 'professional',
      goal,
    });

    for (let j = 0; j < batch.length; j++) {
      const assignment = batch[j];
      const post = generated[j] || generated.find((p) => p.platform === assignment.platform);
      const design = designs.length ? designs[ids.length % designs.length] : null;
      const mediaUrl = design ? designMediaUrl(design) : null;
      const platform = post?.platform || assignment.platform;

      if (!post?.content) {
        const fallback = await createFallbackPost({
          assignment, goal, design, workspaceId, userId, campaignId,
        });
        ids.push(fallback._id);
        continue;
      }

      const content = await Content.create({
        workspace: workspaceId,
        createdBy: userId,
        type: 'post',
        platform,
        content: post.content,
        hashtags: post.hashtags || [],
        mediaUrl: IMAGE_PLATFORMS.has(platform) ? mediaUrl : (mediaUrl || undefined),
        thumbnailUrl: mediaUrl || undefined,
        campaign: campaignId,
        status: 'draft',
        metadata: {
          module: 'launch',
          campaignId: String(campaignId),
          campaignGoal: goal,
          designId: design?._id ? String(design._id) : undefined,
        },
      });
      ids.push(content._id);
    }
  } catch (e) {
    logger.error(`Launch batch generation failed: ${e.message}`);
    for (const assignment of batch) {
      try {
        const design = designs.length ? designs[ids.length % designs.length] : null;
        const fallback = await createFallbackPost({
          assignment, goal, design, workspaceId, userId, campaignId,
        });
        ids.push(fallback._id);
      } catch (fallbackErr) {
        logger.error(`Launch fallback post failed: ${fallbackErr.message}`);
      }
    }
  }
  return ids;
};

const runOneLaunchStep = async (campaign, user, workspace) => {
  const meta = { ...(campaign.metadata || {}) };
  const phase = meta.launchPhase || 'init';
  const payload = meta.launchPayload || {};
  const {
    workspaceId = campaign.workspace,
    goal = campaign.goal,
    timeline = campaign.timeline || 30,
    budget,
    userId = campaign.createdBy,
    sourceContentId,
    designIds,
    topic,
    scheduleMode = campaign.scheduleMode || 'immediate',
    scheduleStartAt,
    platforms: requestedPlatforms,
  } = payload;

  const brandProfile = workspace?.brandProfile || {};
  const platforms = campaign.platforms?.length
    ? campaign.platforms
    : resolvePlatforms(requestedPlatforms, user, workspace);
  const integrationStatus = getLaunchIntegrationStatus(user, platforms);

  if (phase === 'init') {
    const { sourceContent, designs } = await loadSourceAssets({
      workspaceId: campaign.workspace,
      sourceContentId: sourceContentId || campaign.sourceContent?.contentId,
      designIds: designIds || campaign.sourceContent?.designIds,
    });

    const isScheduled = scheduleMode === 'scheduled' && scheduleStartAt;
    const startDate = isScheduled ? new Date(scheduleStartAt) : new Date();
    if (!isScheduled) startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(timeline));

    let contentIds = [...(campaign.content || [])];

    if (sourceContent?.content && contentIds.length === 0) {
      const platform = platforms[0];
      const design = designs.length ? designs[0] : null;
      const mediaUrl = design ? designMediaUrl(design) : null;
      const first = await Content.create({
        workspace: workspaceId,
        createdBy: userId,
        type: 'post',
        platform,
        content: sourceContent.content,
        hashtags: sourceContent.hashtags || [],
        mediaUrl: IMAGE_PLATFORMS.has(platform) ? mediaUrl : (mediaUrl || undefined),
        thumbnailUrl: mediaUrl || undefined,
        campaign: campaign._id,
        status: 'draft',
        metadata: {
          module: 'launch',
          campaignId: String(campaign._id),
          campaignGoal: goal,
          sourceContentId: String(sourceContent._id),
          designId: design?._id ? String(design._id) : undefined,
        },
      });
      contentIds.push(first._id);
    } else if (!sourceContent?.content && designs.length && contentIds.length === 0) {
      const seeded = await seedPostsFromDesigns({
        designs, platforms, workspaceId, userId, campaignId: campaign._id, goal,
      });
      contentIds.push(...seeded);
    }

    campaign.platforms = platforms;
    campaign.timeline = timeline;
    campaign.budget = budget || '';
    campaign.scheduleMode = isScheduled ? 'scheduled' : 'immediate';
    campaign.scheduledLaunchAt = isScheduled ? startDate : undefined;
    campaign.startDate = startDate;
    campaign.endDate = endDate;
    campaign.sourceContent = {
      contentId: sourceContent?._id || sourceContentId || undefined,
      designIds: designs.map((d) => d._id),
      topic: topic || sourceContent?.content?.slice(0, 120) || undefined,
    };
    campaign.content = contentIds;

    if (!integrationStatus.ready) {
      campaign.error = `Connect ${formatPlatformList(integrationStatus.missing)} in Social Channels to publish after launch.`;
    } else {
      campaign.error = undefined;
    }

    meta.launchPhase = 'topics';
    meta.integrationStatus = integrationStatus;
    meta.launchContext = {
      postCount: planPostCount(platforms, Boolean(sourceContent?.content)),
      hasSourceContent: Boolean(sourceContent?.content),
    };
    campaign.metadata = meta;
    await campaign.save();
    return { progressed: true, done: false };
  }

  if (phase === 'topics') {
    const { sourceContent } = await loadSourceAssets({
      workspaceId: campaign.workspace,
      sourceContentId: sourceContentId || campaign.sourceContent?.contentId,
      designIds: designIds || campaign.sourceContent?.designIds,
    });
    const postCount = meta.launchContext?.postCount || planPostCount(platforms, Boolean(sourceContent?.content));
    const seedTopic = topic || sourceContent?.content?.slice(0, 200) || goal;

    if (!meta.topics?.length) {
      meta.topics = buildInstantTopics(postCount, seedTopic, goal);
    }

    if (!meta.assignments?.length) {
      const assignments = [];
      for (let i = 0; i < Math.min(meta.topics.length, postCount); i++) {
        if (i === 0 && sourceContent?.content) continue;
        assignments.push({
          platform: platforms[i % platforms.length],
          topic: meta.topics[i],
        });
      }
      meta.assignments = assignments;
      meta.assignmentIndex = 0;
    }

    meta.launchPhase = 'posts';
    campaign.metadata = meta;
    await campaign.save();
    return { progressed: true, done: false };
  }

  if (phase === 'posts') {
    const assignments = meta.assignments || [];
    const index = meta.assignmentIndex || 0;
    const batch = assignments.slice(index, index + BATCH_SIZE);

    if (!batch.length) {
      meta.launchPhase = 'strategy';
      campaign.metadata = meta;
      await campaign.save();
      return { progressed: true, done: false };
    }

    const { designs } = await loadSourceAssets({
      workspaceId: campaign.workspace,
      sourceContentId: sourceContentId || campaign.sourceContent?.contentId,
      designIds: designIds || campaign.sourceContent?.designIds,
    });

    const contentIds = await generatePostsForBatch({
      batch,
      brandProfile,
      goal,
      designs,
      workspaceId,
      userId,
      campaignId: campaign._id,
      contentIds: campaign.content || [],
    });

    meta.assignmentIndex = index + batch.length;
    campaign.content = contentIds;
    if (meta.assignmentIndex >= assignments.length) {
      meta.launchPhase = 'strategy';
    }
    campaign.metadata = meta;
    await campaign.save();
    return { progressed: true, done: false };
  }

  if (phase === 'strategy') {
    if (!campaign.strategy) {
      const postCount = (campaign.content || []).length;
      campaign.strategy = `## ${timeline}-day launch plan\n\nPublish ${postCount} post${postCount === 1 ? '' : 's'} across ${formatPlatformList(platforms)} over ${timeline} days.\n\nReview each post in Approvals, then schedule or publish to your connected channels.`;
    }
    meta.launchPhase = 'finalize';
    campaign.metadata = meta;
    await campaign.save();
    return { progressed: true, done: false };
  }

  if (phase === 'finalize') {
    const contentIds = campaign.content || [];
    const isScheduled = campaign.scheduleMode === 'scheduled';

    if (contentIds.length && campaign.startDate && campaign.endDate) {
      await finalizeCampaignPosts({
        campaignId: campaign._id,
        workspaceId,
        userId,
        goal,
        contentIds,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      });

      if (isScheduled) {
        await scheduleLaunchCampaignPosts({
          campaignId: campaign._id,
          workspaceId,
          userId,
          contentIds,
        });
      }
    }

    campaign.status = contentIds.length
      ? (isScheduled ? 'active' : 'review')
      : 'draft';
    if (!contentIds.length) {
      campaign.error = campaign.error || 'Could not generate posts. Check your AI API keys and try again.';
    } else if (!integrationStatus.ready) {
      campaign.error = `Posts ready — connect ${formatPlatformList(integrationStatus.missing)} in Social Channels to publish.`;
    } else {
      campaign.error = undefined;
    }
    meta.launchPhase = 'done';
    campaign.metadata = meta;
    await campaign.save();
    logger.info(`Campaign ${campaign._id} generated with ${contentIds.length} content pieces on ${platforms.join(', ')}`);
    return { progressed: true, done: true };
  }

  return { progressed: false, done: campaign.status !== 'generating' };
};

const advanceLaunchCampaign = async ({
  campaignId,
  userId,
  maxSteps = 1,
  maxMs,
}) => {
  const budget = maxMs ?? (maxSteps === 1 ? LAUNCH_STEP_TIMEOUT_MS : (process.env.VERCEL ? 42_000 : 85_000));
  const deadline = Date.now() + budget;
  let stepsRun = 0;
  const stepCap = maxSteps === Infinity ? Number.MAX_SAFE_INTEGER : maxSteps;

  while (Date.now() < deadline && stepsRun < stepCap) {
    const campaign = await Campaign.findOne({ _id: campaignId, createdBy: userId });
    if (!campaign || campaign.status !== 'generating') break;

    const [user, workspace] = await Promise.all([
      User.findById(userId),
      Workspace.findById(campaign.workspace),
    ]);

    try {
      const step = await runOneLaunchStep(campaign, user, workspace);
      stepsRun += 1;
      if (step.done || !step.progressed) break;
    } catch (err) {
      logger.error(`Launch step failed: ${err.message}`);
      const existing = await Campaign.findById(campaignId);
      const partialCount = existing?.content?.length || 0;
      const payload = existing?.metadata?.launchPayload || {};
      await Campaign.findByIdAndUpdate(campaignId, {
        status: partialCount
          ? (existing?.scheduleMode === 'scheduled' ? 'active' : 'review')
          : 'draft',
        error: partialCount
          ? undefined
          : (err.message?.includes('timed out')
            ? 'Generation timed out — try launching again with fewer platforms.'
            : err.message || 'Campaign generation failed'),
      });
      if (partialCount && existing?.startDate && existing?.endDate) {
        await finalizeCampaignPosts({
          campaignId,
          workspaceId: payload.workspaceId || existing.workspace,
          userId,
          goal: payload.goal || existing.goal,
          contentIds: existing.content,
          startDate: existing.startDate,
          endDate: existing.endDate,
        });
      }
      break;
    }
  }

  const campaign = await Campaign.findOne({ _id: campaignId, createdBy: userId })
    .populate('content')
    .populate('sourceContent.contentId', 'content platform title hashtags')
    .lean();

  const user = await User.findById(userId);
  const integrationStatus = campaign?.metadata?.integrationStatus
    || getLaunchIntegrationStatus(user, campaign?.platforms || []);

  return {
    done: campaign?.status !== 'generating',
    campaign,
    integrationStatus,
    phase: campaign?.metadata?.launchPhase,
    progressMessage: buildLaunchProgressMessage(campaign, integrationStatus),
  };
};

const generateCampaign = async (payload) => {
  const { campaignId, userId } = payload;
  await Campaign.findByIdAndUpdate(campaignId, {
    $set: {
      'metadata.launchPayload': payload,
      'metadata.launchPhase': 'init',
    },
  });
  await advanceLaunchCampaign({ campaignId, userId, maxSteps: Infinity });
};

const generateCampaignTopics = async (goal, brandProfile, count, seedTopic, sourceContent) => {
  const sourceHint = sourceContent?.content
    ? ` Base ideas on this saved copy: "${sourceContent.content.slice(0, 300)}"`
    : '';
  try {
    const data = await generateJSON({
      label: 'LaunchTopics',
      system: 'Return ONLY valid JSON.',
      user: `Generate ${count} distinct content topic ideas for a campaign goal: "${goal}". Seed topic: "${seedTopic}".${sourceHint} Brand: ${brandProfile.name || 'startup'}, industry: ${brandProfile.industry || 'tech'}. Return JSON: { "topics": ["topic1", "..."] }`,
      timeoutMs: LAUNCH_TOPICS_TIMEOUT_MS,
    });
    if (data.topics?.length) return data.topics.slice(0, count);
  } catch (e) {
    logger.error(`Topic generation failed: ${e.message}`);
  }
  return Array.from({ length: count }, (_, i) => `${seedTopic || goal} — angle ${i + 1}`);
};

const STALE_MS = 2 * 60 * 1000;

const recoverCampaignIfStuck = async (campaignId, userId) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    createdBy: userId,
    status: 'generating',
  });
  if (!campaign) return false;

  const age = Date.now() - new Date(campaign.updatedAt).getTime();
  if (age < STALE_MS) return false;

  const count = campaign.content?.length || 0;
  if (count > 0) {
    campaign.status = campaign.scheduleMode === 'scheduled' ? 'active' : 'review';
    campaign.error = undefined;
    await campaign.save();
    logger.info(`Recovered stuck campaign ${campaignId} with ${count} posts`);
    return true;
  }

  await Campaign.updateOne(
    { _id: campaign._id },
    { $set: { status: 'draft', error: 'Generation timed out. Please try launching again.' } },
  );
  logger.info(`Marked stuck campaign ${campaignId} as timed out`);
  return true;
};

const recoverStaleCampaigns = async (userId) => {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await Campaign.find({
    createdBy: userId,
    status: 'generating',
    updatedAt: { $lt: cutoff },
  });

  for (const campaign of stale) {
    const count = campaign.content?.length || 0;
    if (count > 0) {
      campaign.status = 'review';
      campaign.error = undefined;
      await campaign.save();
      logger.info(`Recovered partial campaign ${campaign._id} with ${count} posts`);
    } else {
      await Campaign.updateOne(
        { _id: campaign._id },
        { $set: { status: 'draft', error: 'Generation timed out. Please try launching again.' } },
      );
    }
  }
};

const isLaunchContent = (content, launchContentIds) => (
  content?.metadata?.module === 'launch'
  || launchContentIds.has(String(content?._id))
  || Boolean(content?.campaign)
);

const getLaunchOverview = async ({ workspaceId, userId }) => {
  const campaigns = await Campaign.find({ workspace: workspaceId, createdBy: userId, type: 'launch' })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('content', 'platform status publishedAt scheduledAt content title metadata')
    .lean();

  const launchContentIds = new Set();
  const campaignByContent = new Map();
  campaigns.forEach((c) => {
    (c.content || []).forEach((item) => {
      const key = String(item._id || item);
      launchContentIds.add(key);
      campaignByContent.set(key, c);
    });
  });

  const [published, scheduledContent, queuedJobs] = await Promise.all([
    Content.find({
      workspace: workspaceId,
      status: 'published',
      $or: [
        { 'metadata.module': 'launch' },
        { campaign: { $in: campaigns.map((c) => c._id) } },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(20)
      .select('platform content title publishedAt campaign metadata')
      .lean(),
    Content.find({
      workspace: workspaceId,
      status: 'scheduled',
      $or: [
        { 'metadata.module': 'launch' },
        { campaign: { $in: campaigns.map((c) => c._id) } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .limit(20)
      .select('platform content title scheduledAt campaign metadata')
      .lean(),
    require('../models/PublishJob').find({
      workspace: workspaceId,
      status: { $in: ['queued', 'processing'] },
    })
      .populate('content', 'platform content title scheduledAt campaign metadata')
      .sort({ scheduledAt: 1 })
      .limit(20)
      .lean(),
  ]);

  const formatPost = (content, extra = {}) => {
    const campaign = campaignByContent.get(String(content._id))
      || campaigns.find((c) => String(c._id) === String(content.campaign));
    return {
      _id: content._id,
      platform: content.platform,
      content: content.content,
      title: content.title,
      publishedAt: content.publishedAt,
      scheduledAt: content.scheduledAt || extra.scheduledAt,
      campaignName: campaign?.name || campaign?.goal?.slice(0, 50),
    };
  };

  const launched = published.map((c) => formatPost(c));
  const scheduledMap = new Map();

  scheduledContent.forEach((c) => {
    scheduledMap.set(String(c._id), formatPost(c));
  });

  queuedJobs.forEach((job) => {
    if (!job.content || !isLaunchContent(job.content, launchContentIds)) return;
    scheduledMap.set(String(job.content._id), formatPost(job.content, { scheduledAt: job.scheduledAt }));
  });

  campaigns.forEach((c) => {
    (c.content || []).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      if (!['review', 'approved', 'draft'].includes(item.status)) return;
      const at = item.metadata?.suggestedScheduledAt || item.scheduledAt;
      if (!at) return;
      scheduledMap.set(String(item._id), formatPost({ ...item, scheduledAt: at }));
    });
  });

  const scheduled = [...scheduledMap.values()].sort(
    (a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0),
  );

  const campaignsWithStats = campaigns.map((c) => {
    const items = (c.content || []).map((item) => (typeof item === 'object' ? item : null)).filter(Boolean);
    return {
      ...c,
      stats: {
        published: items.filter((i) => i.status === 'published').length,
        scheduled: items.filter((i) => ['scheduled', 'approved'].includes(i.status)).length,
        review: items.filter((i) => i.status === 'review').length,
        total: items.length,
      },
    };
  });

  return { campaigns: campaignsWithStats, launched, scheduled };
};

module.exports = {
  generateCampaign,
  advanceLaunchCampaign,
  getLaunchIntegrationStatus,
  buildLaunchProgressMessage,
  recoverStaleCampaigns,
  recoverCampaignIfStuck,
  getLaunchOverview,
  scheduleLaunchCampaign,
  ALL_PLATFORMS,
};
