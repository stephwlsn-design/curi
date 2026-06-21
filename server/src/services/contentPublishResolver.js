const Content = require('../models/Content');

const pickMediaUrl = (item) => {
  if (!item) return null;
  const meta = item.metadata?.toObject?.() ?? item.metadata ?? {};
  return item.mediaUrl
    || item.thumbnailUrl
    || meta.referenceImageUrl
    || meta.imageUrl
    || meta.previewDataUrl
    || null;
};

const resolveContentForPublish = async (contentDoc) => {
  const base = contentDoc.toObject ? contentDoc.toObject() : { ...contentDoc };
  if (base.mediaUrl || base.thumbnailUrl) return base;

  if (!base.calendarEntry) return base;

  const creatives = await Content.find({
    calendarEntry: base.calendarEntry,
    workspace: base.workspace,
    type: { $in: ['image', 'video'] },
  }).sort({ type: 1, updatedAt: -1 });

  for (const creative of creatives) {
    const mediaUrl = pickMediaUrl(creative);
    if (mediaUrl) {
      return {
        ...base,
        mediaUrl,
        thumbnailUrl: mediaUrl,
        content: base.content || creative.content || creative.title,
      };
    }
  }

  return base;
};

module.exports = { resolveContentForPublish, pickMediaUrl };
