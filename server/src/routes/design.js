const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { uploadDesignIdea, uploadUserDesigns } = require('../middleware/upload');
const designService = require('../services/designService');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const DesignTemplate = require('../models/DesignTemplate');
const { toPublicImageUrl, normalizeDesignIdea, attachPreviewFromBuffer, analyzeDesignIdeaIfNeeded } = require('../utils/designIdea');
const { designToCanvas, BUILTIN_TEMPLATES, buildCanvasWithDesignIdea } = require('../utils/designCanvas');
const { getGraphicTemplate, buildGraphicCanvas } = require('../utils/graphicCanvas');
const pexelsService = require('../services/pexelsService');
const { createUploadedDesign, scheduleContent } = require('../services/designUploadService');
const PublishJob = require('../models/PublishJob');

router.post('/idea', uploadDesignIdea.single('image'), async (req, res) => {
  const { workspaceId, notes = '' } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  if (!req.file && !notes?.trim()) {
    if (workspace.brandProfile?.designIdea) {
      workspace.brandProfile.designIdea = undefined;
      await workspace.save();
    }
    return res.json({ designIdea: null });
  }

  const existing = workspace.brandProfile?.designIdea || {};
  let designIdea = {
    notes: String(notes || '').trim(),
    filename: req.file?.filename || existing.filename || null,
    imageUrl: req.file ? toPublicImageUrl(req.file.filename) : (existing.imageUrl || null),
    uploadedAt: req.file ? new Date() : (existing.uploadedAt || new Date()),
    analyzedDirection: req.file ? undefined : existing.analyzedDirection,
    analyzedSpec: req.file ? undefined : existing.analyzedSpec,
    previewDataUrl: req.file ? undefined : existing.previewDataUrl,
  };

  if (req.file) {
    const fs = require('fs');
    const buf = fs.readFileSync(req.file.path);
    designIdea = attachPreviewFromBuffer(designIdea, buf, req.file.mimetype || 'image/jpeg');
  }

  workspace.brandProfile = workspace.brandProfile || {};
  workspace.brandProfile.designIdea = designIdea;

  if (designIdea.previewDataUrl || (designIdea.imageUrl && req.file)) {
    designIdea = await analyzeDesignIdeaIfNeeded(designIdea, designService);
    workspace.brandProfile.designIdea = designIdea;
  }

  await workspace.save();

  res.json({ designIdea });
});

router.post('/from-inspiration', checkCredits(2), async (req, res) => {
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
  } = req.body;

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const rawIdea = designIdeaInput || workspace.brandProfile?.designIdea || {};
  const designIdea = normalizeDesignIdea(rawIdea);

  if (!designIdea.notes && !designIdea.hasImage && !rawIdea.imageUrl) {
    return res.status(400).json({ error: 'Upload a design inspiration image or add creative notes first' });
  }

  try {
    const ideaContext = await designService.resolveDesignIdeaContext({
      ...rawIdea,
      ...designIdea,
      analyzedSpec: rawIdea.analyzedSpec,
      analyzedDirection: rawIdea.analyzedDirection,
    });

    if (ideaContext?.spec || ideaContext?.direction) {
      workspace.brandProfile = workspace.brandProfile || {};
      workspace.brandProfile.designIdea = {
        ...(workspace.brandProfile.designIdea || {}),
        notes: rawIdea.notes || designIdea.notes,
        filename: rawIdea.filename || designIdea.filename,
        imageUrl: ideaContext.imageUrl || rawIdea.imageUrl || designIdea.imageUrl,
        analyzedDirection: ideaContext.direction,
        analyzedSpec: ideaContext.spec,
        uploadedAt: workspace.brandProfile.designIdea?.uploadedAt || new Date(),
      };
      await workspace.save();
    }

    const brandColors = workspace.brandProfile?.colors?.palette
      || ideaContext?.spec?.colorPalette
      || ['#FF6B9D', '#4DA8EE', '#1A2B48'];

    const design = {
      headline: headline || prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline',
      subheadline: subheadline ?? prompt.slice(0, 120) ?? '',
      cta: cta || 'Learn More',
      layout: ideaContext?.spec?.layout || 'centered',
      dimensions: { id: dimensionId },
      colorPalette: ideaContext?.spec?.colorPalette || brandColors,
      name: 'Inspired Design',
      referenceImageUrl: ideaContext?.imageUrl,
      designIdeaApplied: true,
      postFormat,
      creativeType,
      compositionNotes: ideaContext?.direction
        ? `Aesthetic extracted (text stripped): ${ideaContext.direction.slice(0, 200)}`
        : undefined,
    };

    const enriched = designService.applyDesignIdeaToDesign(design, ideaContext);
    const canvasLayout = (ideaContext?.imageUrl || ideaContext?.spec)
      ? buildCanvasWithDesignIdea(enriched, ideaContext, dimensionId, templateId)
      : designToCanvas(enriched, templateId);

    const saved = await Content.create({
      workspace: workspaceId,
      createdBy: req.user._id,
      type: 'image',
      platform: 'universal',
      title: enriched.name,
      content: enriched.headline,
      metadata: {
        ...enriched,
        module: 'design',
        canvasLayout,
        designIdea: {
          notes: rawIdea.notes || designIdea.notes,
          imageUrl: ideaContext?.imageUrl || rawIdea.imageUrl,
          referenceImageUrl: ideaContext?.imageUrl,
        },
        referenceImageUrl: ideaContext?.imageUrl,
        inspirationExtracted: true,
      },
      status: 'draft',
    });

    workspace.stats.imagesGenerated = (workspace.stats.imagesGenerated || 0) + 1;
    await workspace.save();
    await req.user.deductCredits(req.creditCost);

    res.status(201).json({
      design: { ...(saved.metadata?.toObject?.() ?? saved.metadata ?? {}), _id: saved._id },
      designIdea: workspace.brandProfile?.designIdea,
    });
  } catch (err) {
    const msg = err.message?.includes('quota') || err.status === 429
      ? 'AI quota exceeded — check your Gemini or OpenAI billing'
      : err.message || 'Could not extract design from inspiration';
    res.status(502).json({ error: msg });
  }
});

router.post('/generate', checkCredits(5), async (req, res) => {
  const {
    workspaceId, prompt, creativeType = 'social_post', channels = ['instagram'],
    dimensionId = '1080x1080', variantCount = 5, style = 'modern', collectionMode = false,
    designIdea: designIdeaInput,
  } = req.body;

  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const designIdea = normalizeDesignIdea(designIdeaInput || workspace.brandProfile?.designIdea);

  try {
    const designIdeaContext = designIdea.notes || designIdea.hasImage
      ? await designService.resolveDesignIdeaContext(designIdea)
      : null;

    const result = await designService.generateDesigns({
      brandProfile: workspace.brandProfile,
      prompt, creativeType, channels, dimensionId, variantCount, style, collectionMode,
      designIdeaContext,
    });

    const saved = await Promise.all(result.designs.map(d => {
      const canvasLayout = designIdeaContext?.imageUrl
        ? buildCanvasWithDesignIdea(d, designIdeaContext, dimensionId)
        : designToCanvas(d);
      return Content.create({
        workspace: workspaceId,
        createdBy: req.user._id,
        type: 'image',
        platform: channels[0] || 'universal',
        title: d.name,
        content: d.headline,
        metadata: {
          ...d,
          module: 'design',
          collectionName: result.collectionName,
          canvasLayout,
          designIdea: designIdea.notes || designIdea.imageUrl ? {
            notes: designIdea.notes,
            imageUrl: designIdea.imageUrl,
            referenceImageUrl: designIdeaContext?.imageUrl,
          } : undefined,
          referenceImageUrl: d.referenceImageUrl || designIdeaContext?.imageUrl,
        },
        status: 'draft',
      });
    }));

    workspace.stats.imagesGenerated = (workspace.stats.imagesGenerated || 0) + saved.length;
    await workspace.save();
    await req.user.deductCredits(req.creditCost);

    res.status(201).json({
      collectionName: result.collectionName,
      designs: saved.map(c => ({ ...(c.metadata?.toObject?.() ?? c.metadata ?? {}), _id: c._id })),
    });
  } catch (err) {
    const msg = err.message?.includes('quota') || err.status === 429
      ? 'AI quota exceeded — check your Gemini or OpenAI billing'
      : err.message?.includes('GEMINI') || err.message?.includes('API key')
        ? 'AI API key error — check GEMINI_API_KEY in server/.env'
        : err.message || 'Design generation failed';
    res.status(502).json({ error: msg });
  }
});

router.get('/library', async (req, res) => {
  const { workspaceId } = req.query;
  const { listDesignLibrary } = require('../services/designSaveService');
  const designs = await listDesignLibrary(workspaceId);
  res.json({ designs });
});

router.get('/templates', async (req, res) => {
  const { workspaceId } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const userTemplates = await DesignTemplate.find({ workspace: workspaceId })
    .sort({ createdAt: -1 }).limit(30);

  res.json({
    builtin: BUILTIN_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name || t.id,
      category: 'builtin',
      placements: t.placements,
    })),
    templates: userTemplates,
  });
});

router.post('/templates', async (req, res) => {
  const { workspaceId, name, canvasLayout, dimensionId, description, thumbnailColors } = req.body;
  if (!name?.trim() || !canvasLayout) {
    return res.status(400).json({ error: 'Name and canvas layout are required' });
  }

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const template = await DesignTemplate.create({
    workspace: workspaceId,
    createdBy: req.user._id,
    name: name.trim(),
    description,
    dimensionId: dimensionId || '1080x1080',
    canvasLayout,
    thumbnailColors,
  });

  res.status(201).json({ template });
});

router.delete('/templates/:id', async (req, res) => {
  const template = await DesignTemplate.findOneAndDelete({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json({ message: 'Template deleted' });
});

router.post('/character/speak', checkCredits(1), async (req, res) => {
  const { text, language = 'en', tonality = 'friendly', gender = 'female' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Script text is required' });

  try {
    const talkingCharacterService = require('../services/talkingCharacterService');
    const result = await talkingCharacterService.synthesizeSpeech({ text, language, tonality, gender });
    await req.user.deductCredits(req.creditCost);
    res.json(result);
  } catch (err) {
    const status = err.status || (err.code === 'TTS_UNAVAILABLE' ? 503 : 502);
    res.status(status).json({
      error: err.message,
      hint: err.hint,
      code: err.code,
    });
  }
});

router.post('/character/lipsync', checkCredits(3), async (req, res) => {
  const { imageDataUrl, audioDataUrl, portrait = true } = req.body;
  if (!imageDataUrl || !audioDataUrl) {
    return res.status(400).json({ error: 'Image and audio are required for lip-sync' });
  }

  try {
    const lipSyncService = require('../services/lipSyncService');
    const result = await lipSyncService.generateLipSyncVideo({
      imageDataUrl,
      audioDataUrl,
      portrait: portrait !== false,
    });
    if (result.videoUrl) {
      await req.user.deductCredits(req.creditCost);
    }
    res.json(result);
  } catch (err) {
    const status = err.status || (err.code === 'LIPSYNC_UNAVAILABLE' ? 503 : 502);
    res.status(status).json({
      error: err.message,
      hint: err.hint,
      code: err.code,
    });
  }
});

router.get('/character/lipsync/:requestId', async (req, res) => {
  try {
    const lipSyncService = require('../services/lipSyncService');
    const result = await lipSyncService.getLipSyncJob(req.params.requestId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({
      error: err.message,
      hint: err.hint,
      code: err.code,
    });
  }
});

router.get('/media/photos', async (req, res) => {
  try {
    const { query, page = 1, perPage = 24 } = req.query;
    const result = await pexelsService.searchPhotos({
      query,
      page: Number(page),
      perPage: Number(perPage),
    });
    res.json(result);
  } catch (err) {
    res.status(err.message?.includes('PEXELS') ? 503 : 502).json({ error: err.message });
  }
});

router.get('/media/videos', async (req, res) => {
  try {
    const { query, page = 1, perPage = 15 } = req.query;
    const result = await pexelsService.searchVideos({
      query,
      page: Number(page),
      perPage: Number(perPage),
    });
    res.json(result);
  } catch (err) {
    res.status(err.message?.includes('PEXELS') ? 503 : 502).json({ error: err.message });
  }
});

router.post('/from-media', checkCredits(2), async (req, res) => {
  const {
    workspaceId,
    mediaType,
    url,
    thumbnailUrl,
    pexelsId,
    photographer,
    photographerUrl,
    useAs = 'background',
    dimensionId = '1080x1080',
    headline,
    subheadline,
    cta,
    duration,
  } = req.body;

  if (!url || !mediaType) {
    return res.status(400).json({ error: 'mediaType and url are required' });
  }

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const brandColors = workspace.brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#1A2B48'];
  const pexelsMeta = {
    id: pexelsId,
    photographer,
    photographerUrl,
    source: 'pexels',
    mediaType,
    url,
    thumbnailUrl,
    duration,
  };

  let canvasLayout;
  let design;
  let contentType = 'image';

  if (mediaType === 'video') {
    contentType = 'video';
    const dims = {
      '1080x1080': { width: 1080, height: 1080 },
      '1080x1920': { width: 1080, height: 1920 },
      '1920x1080': { width: 1920, height: 1080 },
    }[dimensionId] || { width: 1080, height: 1080 };

    canvasLayout = {
      width: dims.width,
      height: dims.height,
      templateId: 'pexels-video',
      background: {
        type: 'video',
        url,
        poster: thumbnailUrl,
        overlay: 'rgba(0,0,0,0.2)',
      },
      elements: headline ? [{
        id: 'headline',
        type: 'text',
        text: headline,
        x: 48,
        y: 48,
        width: dims.width - 96,
        fontSize: 42,
        fontWeight: 800,
        color: '#ffffff',
        align: 'left',
        visible: true,
        zIndex: 4,
      }] : [],
    };

    design = {
      name: headline || 'Stock Video',
      headline: headline || 'Stock Video',
      dimensions: { id: dimensionId },
      colorPalette: brandColors,
      mediaUrl: url,
      thumbnailUrl,
      videoUrl: url,
    };
  } else {
    design = {
      headline: headline || 'Your Headline',
      subheadline: subheadline || '',
      cta: cta || 'Learn More',
      layout: 'pexels',
      dimensions: { id: dimensionId },
      colorPalette: brandColors,
      name: headline || 'Stock Photo Design',
    };

    canvasLayout = designToCanvas(design, 'centered-hero');
    if (useAs === 'layer') {
      canvasLayout.elements.push({
        id: `pexels-${pexelsId || Date.now()}`,
        type: 'image',
        url,
        x: Math.round(canvasLayout.width * 0.08),
        y: Math.round(canvasLayout.height * 0.12),
        width: Math.round(canvasLayout.width * 0.84),
        height: Math.round(canvasLayout.height * 0.45),
        borderRadius: 12,
        visible: true,
        zIndex: 3,
      });
    } else {
      canvasLayout.background = {
        type: 'image',
        url,
        overlay: 'rgba(0,0,0,0.38)',
      };
    }
  }

  const saved = await Content.create({
    workspace: workspaceId,
    createdBy: req.user._id,
    type: contentType,
    platform: 'universal',
    title: design.name,
    content: design.headline,
    metadata: {
      ...design,
      module: 'design',
      canvasLayout,
      pexels: pexelsMeta,
    },
    status: 'draft',
  });

  await req.user.deductCredits(req.creditCost);
  res.status(201).json({
    design: { ...(saved.metadata?.toObject?.() ?? saved.metadata), _id: saved._id },
  });
});

router.post('/save', async (req, res) => {
  try {
    const { saveDesignDraft } = require('../services/designSaveService');
    const design = await saveDesignDraft({
      user: req.user,
      workspaceId: req.body.workspaceId,
      body: req.body,
    });
    res.status(201).json({ design });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Save failed' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { patchDesign } = require('../services/designSaveService');
    const design = await patchDesign({
      user: req.user,
      designId: req.params.id,
      body: req.body,
    });
    res.json({ design });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Update failed' });
  }
});

router.post('/from-template', checkCredits(3), async (req, res) => {
  const {
    workspaceId, templateId, templatePlacements, headline, subheadline, cta,
    badge, dimensionId = '1080x1080',
  } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const brandColors = workspace.brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#1A2B48'];
  const graphic = getGraphicTemplate(templateId);

  if (graphic) {
    const canvasLayout = buildGraphicCanvas(graphic, {
      headline: headline || graphic.sampleCopy?.headline || 'Your Headline',
      subheadline: subheadline ?? graphic.sampleCopy?.subheadline ?? '',
      cta: cta ?? graphic.sampleCopy?.cta ?? '',
      badge: badge ?? graphic.sampleCopy?.badge ?? '',
      colorPalette: brandColors,
    }, dimensionId || graphic.recommendedDimension);

    const design = {
      headline: headline || graphic.sampleCopy?.headline || 'Your Headline',
      subheadline: subheadline ?? graphic.sampleCopy?.subheadline ?? '',
      cta: cta ?? graphic.sampleCopy?.cta ?? '',
      layout: graphic.category,
      dimensions: { id: dimensionId || graphic.recommendedDimension },
      colorPalette: brandColors,
      name: graphic.name,
    };

    const saved = await Content.create({
      workspace: workspaceId,
      createdBy: req.user._id,
      type: 'image',
      platform: 'universal',
      title: graphic.name,
      content: design.headline,
      metadata: { ...design, module: 'design', canvasLayout, templateId: graphic.id, graphicTemplate: true },
      status: 'draft',
    });

    await req.user.deductCredits(req.creditCost);
    return res.status(201).json({
      design: { ...(saved.metadata?.toObject?.() ?? saved.metadata), _id: saved._id },
    });
  }

  const design = {
    headline: headline || 'Your Headline',
    subheadline: subheadline || '',
    cta: cta || 'Learn More',
    layout: 'centered',
    dimensions: { id: dimensionId },
    colorPalette: workspace.brandProfile?.colors?.palette || ['#FF6B9D', '#4DA8EE', '#1A2B48'],
    name: 'From Template',
  };

  const canvasLayout = designToCanvas(design, templateId);
  if (templatePlacements) {
    canvasLayout.elements = canvasLayout.elements.map(el => {
      const p = templatePlacements[el.id];
      if (!p) return el;
      return {
        ...el,
        x: Math.round(p.x * canvasLayout.width),
        y: Math.round(p.y * canvasLayout.height),
        width: p.width ? Math.round(p.width * canvasLayout.width) : el.width,
        fontSize: p.fontSize ?? el.fontSize,
        align: p.align ?? el.align,
      };
    });
  }

  const saved = await Content.create({
    workspace: workspaceId,
    createdBy: req.user._id,
    type: 'image',
    platform: 'universal',
    title: design.name,
    content: design.headline,
    metadata: { ...design, module: 'design', canvasLayout },
    status: 'draft',
  });

  await req.user.deductCredits(req.creditCost);
  res.status(201).json({
    design: { ...(saved.metadata?.toObject?.() ?? saved.metadata), _id: saved._id },
  });
});

router.post('/favorite/:id', async (req, res) => {
  const item = await Content.findOneAndUpdate(
    { _id: req.params.id, type: 'image' },
    { $set: { 'metadata.favorited': true } },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: 'Design not found' });
  res.json({ design: item });
});

router.post('/upload', uploadUserDesigns.array('images', 20), async (req, res) => {
  const { workspaceId, platform = 'instagram', scheduledAt, titles } = req.body;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
  if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one design image' });

  let titleList = [];
  try {
    titleList = titles ? JSON.parse(titles) : [];
  } catch {
    titleList = [];
  }

  const designs = await Promise.all(req.files.map(async (file, i) => {
    const design = await createUploadedDesign({
      workspaceId,
      userId: req.user._id,
      file,
      platform,
      title: titleList[i] || file.originalname,
      scheduledAt: scheduledAt || null,
      module: 'upload',
    });
    try {
      const fs = require('fs');
      const buf = fs.readFileSync(file.path);
      if (buf.length < 1200000) {
        design.previewDataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${buf.toString('base64')}`;
      }
    } catch { /* preview optional */ }
    return design;
  }));

  workspace.stats.imagesGenerated = (workspace.stats.imagesGenerated || 0) + designs.length;
  await workspace.save();

  res.status(201).json({
    designs,
    scheduled: Boolean(scheduledAt),
    message: scheduledAt
      ? `${designs.length} design(s) uploaded and scheduled`
      : `${designs.length} design(s) uploaded`,
  });
});

router.post('/:id/schedule', async (req, res) => {
  const { workspaceId, scheduledAt, platform } = req.body;
  if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });

  const item = await Content.findOne({
    _id: req.params.id,
    workspace: workspaceId,
    createdBy: req.user._id,
    type: 'image',
  });
  if (!item) return res.status(404).json({ error: 'Design not found' });

  await scheduleContent({
    content: item,
    platform: platform || item.platform,
    scheduledAt,
    workspaceId,
  });

  res.json({
    design: item,
    message: 'Design scheduled for publishing',
  });
});

module.exports = router;
