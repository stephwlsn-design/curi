const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const formatDesign = (saved) => ({
  ...(saved.metadata?.toObject?.() ?? saved.metadata ?? {}),
  _id: saved._id,
  canvasLayout: saved.metadata?.canvasLayout,
});

async function saveDesignDraft({ user, workspaceId, body }) {
  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const { canvasLayout, headline, subheadline, cta, layout, name, title } = body;
  if (!canvasLayout) {
    const err = new Error('canvasLayout is required');
    err.status = 400;
    throw err;
  }

  const design = {
    headline: headline || 'Your Headline',
    subheadline: subheadline || '',
    cta: cta || 'Learn More',
    layout: layout || 'custom',
    dimensions: {
      id: body.dimensionId || `${canvasLayout.width || 1080}x${canvasLayout.height || 1080}`,
    },
    colorPalette: canvasLayout.background?.colors || workspace.brandProfile?.colors?.palette || [],
    name: name || title || 'Saved Design',
    module: 'design',
    canvasLayout,
    templateId: canvasLayout.templateId,
  };

  const saved = await Content.create({
    workspace: workspaceId,
    createdBy: user._id,
    type: 'image',
    platform: 'universal',
    title: design.name,
    content: design.headline,
    metadata: design,
    status: 'draft',
  });

  return formatDesign(saved);
}

async function patchDesign({ user, designId, body }) {
  const { workspaceId, canvasLayout, headline, subheadline, cta, layout } = body;
  const item = await Content.findOne({
    _id: designId,
    workspace: workspaceId,
    createdBy: user._id,
    type: 'image',
  });
  if (!item) {
    const err = new Error('Design not found');
    err.status = 404;
    throw err;
  }

  const meta = item.metadata?.toObject?.() ?? { ...item.metadata };
  if (canvasLayout) meta.canvasLayout = canvasLayout;
  if (headline !== undefined) meta.headline = headline;
  if (subheadline !== undefined) meta.subheadline = subheadline;
  if (cta !== undefined) meta.cta = cta;
  if (layout !== undefined) meta.layout = layout;
  if (canvasLayout?.background?.colors) meta.colorPalette = canvasLayout.background.colors;

  item.metadata = meta;
  item.content = headline ?? item.content;
  item.markModified('metadata');
  await item.save();

  return formatDesign(item);
}

async function listDesignLibrary(workspaceId) {
  const designs = await Content.find({
    workspace: workspaceId,
    type: 'image',
    $or: [
      { 'metadata.module': 'design' },
      { 'metadata.module': 'autonomous' },
      { 'metadata.module': 'upload' },
    ],
  }).sort({ createdAt: -1 }).limit(50);

  return designs.map(formatDesign);
}

module.exports = { saveDesignDraft, patchDesign, listDesignLibrary };
