const designService = require('../services/designService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const {
  normalizeDesignIdea,
  buildStoredDesignIdeaContext,
  buildFallbackIdeaContext,
  mergeDesignIdeaSources,
  ensureDesignIdeaForAnalysis,
} = require('../utils/designIdea');
const { designToCanvas, buildCanvasWithDesignIdea, buildMinimalAestheticSpec } = require('../utils/designCanvas');
const logger = require('../utils/logger');

const ANALYSIS_TIMEOUT_MS = process.env.VERCEL ? 22_000 : 25_000;

const processFromInspiration = async ({ user, body, creditCost = 2 }) => {
  const {
    workspaceId,
    designIdea: designIdeaInput,
    prompt = '',
    dimensionId = '1080x1080',
    headline,
    subheadline,
    cta,
    postFormat = 'social_post',
    creativeType = 'social_post',
    templateId,
    analyzeOnly = false,
  } = body;

  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const rawIdea = mergeDesignIdeaSources(designIdeaInput, workspace.brandProfile?.designIdea) || {};
  const preparedIdea = ensureDesignIdeaForAnalysis(rawIdea);
  const designIdea = normalizeDesignIdea(preparedIdea);

  if (!designIdea.notes && !designIdea.hasImage && !rawIdea.imageUrl && !rawIdea.previewDataUrl) {
    const err = new Error('Upload a design inspiration image or add creative notes first');
    err.status = 400;
    throw err;
  }

  const brandColors = workspace.brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#1A2B48'];
  let ideaContext = buildStoredDesignIdeaContext(preparedIdea);

  const hasVisualReference = Boolean(
    designIdea.hasImage || rawIdea.imageUrl || rawIdea.previewDataUrl,
  );
  const specIsAnalyzed = ideaContext?.spec?.inspirationAnalyzed === true;
  let analysisRan = false;

  if (hasVisualReference && !specIsAnalyzed) {
    analysisRan = true;
    try {
      ideaContext = await Promise.race([
        designService.resolveDesignIdeaContext({
          ...preparedIdea,
          ...designIdea,
          analyzedSpec: preparedIdea.analyzedSpec,
          analyzedDirection: preparedIdea.analyzedDirection,
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Style analysis timed out')), ANALYSIS_TIMEOUT_MS);
        }),
      ]);
    } catch (err) {
      logger.warn(`[design] from-inspiration analysis fallback: ${err.message}`);
      ideaContext = buildFallbackIdeaContext({ ...preparedIdea, ...designIdea }, brandColors);
    }
  }

  if (!ideaContext && (designIdea.notes || designIdea.hasImage)) {
    ideaContext = buildFallbackIdeaContext({ ...preparedIdea, ...designIdea }, brandColors);
  }

  const palette = workspace.brandProfile?.colors?.palette
    || ideaContext?.spec?.colorPalette
    || brandColors;

  if (ideaContext && !ideaContext.spec?.inspirationAnalyzed) {
    if (!hasVisualReference) {
      ideaContext = {
        ...ideaContext,
        spec: buildMinimalAestheticSpec(palette),
      };
    } else if (!ideaContext.spec) {
      ideaContext = buildFallbackIdeaContext({ ...preparedIdea, ...designIdea }, brandColors);
    }
  }

  if (ideaContext?.spec || ideaContext?.direction) {
    workspace.brandProfile = workspace.brandProfile || {};
    workspace.brandProfile.designIdea = {
      ...(workspace.brandProfile.designIdea || {}),
      notes: preparedIdea.notes || designIdea.notes,
      filename: preparedIdea.filename || designIdea.filename,
      imageUrl: ideaContext.imageUrl || preparedIdea.imageUrl || designIdea.imageUrl,
      previewDataUrl: preparedIdea.previewDataUrl || designIdea.previewDataUrl
        || workspace.brandProfile.designIdea?.previewDataUrl,
      analyzedDirection: ideaContext.direction,
      analyzedSpec: ideaContext.spec,
      uploadedAt: workspace.brandProfile.designIdea?.uploadedAt || new Date(),
    };
    await workspace.save();
  }

  if (analyzeOnly) {
    if (analysisRan && creditCost > 0) await user.deductCredits(creditCost);
    return {
      designIdea: workspace.brandProfile?.designIdea,
      ideaContext: ideaContext ? {
        direction: ideaContext.direction,
        spec: ideaContext.spec,
        imageUrl: ideaContext.imageUrl,
      } : null,
    };
  }

  const design = {
    headline: headline || prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline',
    subheadline: subheadline ?? prompt.slice(0, 120) ?? '',
    cta: cta || 'Learn More',
    layout: ideaContext?.spec?.layout || 'centered',
    dimensions: { id: dimensionId },
    colorPalette: ideaContext?.spec?.colorPalette || palette,
    name: 'Inspired Design',
    designIdeaApplied: true,
    postFormat,
    creativeType,
    compositionNotes: ideaContext?.direction
      ? `Aesthetic replica (text stripped): ${ideaContext.direction.slice(0, 200)}`
      : undefined,
  };

  const enriched = designService.applyDesignIdeaToDesign(design, ideaContext);
  const canvasLayout = ideaContext?.spec
    ? buildCanvasWithDesignIdea(enriched, ideaContext, dimensionId, templateId)
    : designToCanvas(enriched, templateId);

  const saved = await Content.create({
    workspace: workspaceId,
    createdBy: user._id,
    type: 'image',
    platform: 'universal',
    title: enriched.name,
    content: enriched.headline,
    metadata: {
      ...enriched,
      module: 'design',
      canvasLayout,
      designIdea: {
        notes: preparedIdea.notes || designIdea.notes,
        analyzedDirection: ideaContext?.direction,
        analyzedSpec: ideaContext?.spec,
      },
      inspirationExtracted: true,
      aestheticOnly: true,
    },
    status: 'draft',
  });

  workspace.stats.imagesGenerated = (workspace.stats.imagesGenerated || 0) + 1;
  await workspace.save();
  if (analysisRan && creditCost > 0) await user.deductCredits(creditCost);

  return {
    design: { ...(saved.metadata?.toObject?.() ?? saved.metadata ?? {}), _id: saved._id },
    designIdea: workspace.brandProfile?.designIdea,
  };
};

module.exports = { processFromInspiration };
