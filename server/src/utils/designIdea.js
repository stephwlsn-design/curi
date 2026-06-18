const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../middleware/upload');

const resolveDesignIdeaPath = (designIdea) => {
  if (!designIdea) return null;
  if (designIdea.imagePath && fs.existsSync(designIdea.imagePath)) return designIdea.imagePath;
  if (designIdea.filename) {
    const filePath = path.join(UPLOAD_DIR, path.basename(designIdea.filename));
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
};

const toPublicImageUrl = (filename) => `/api/uploads/design-ideas/${path.basename(filename)}`;

const normalizeDesignIdea = (designIdea = {}) => {
  const notes = String(designIdea.notes || '').trim();
  const filename = designIdea.filename ? path.basename(designIdea.filename) : null;
  const imagePath = resolveDesignIdeaPath({ ...designIdea, filename });
  return {
    notes,
    filename,
    imageUrl: designIdea.imageUrl || (filename ? toPublicImageUrl(filename) : null),
    imagePath,
    hasImage: Boolean(imagePath),
    analyzedDirection: designIdea.analyzedDirection || null,
    analyzedSpec: designIdea.analyzedSpec || null,
  };
};

const buildStoredDesignIdeaContext = (designIdea) => {
  if (!designIdea) return null;
  const idea = normalizeDesignIdea(designIdea);
  if (!idea.notes && !idea.hasImage && !designIdea.analyzedDirection && !designIdea.analyzedSpec) {
    return null;
  }
  if (
    designIdea.analyzedSpec?.aestheticOnly
    && designIdea.analyzedSpec.backgroundMode
    && Array.isArray(designIdea.analyzedSpec.decorElements)
  ) {
    return {
      direction: designIdea.analyzedDirection || idea.notes || '',
      imagePath: idea.imagePath,
      imageUrl: idea.imageUrl,
      spec: designIdea.analyzedSpec,
    };
  }
  if (designIdea.analyzedDirection || idea.notes || idea.imageUrl) {
    return {
      direction: [designIdea.analyzedDirection, idea.notes].filter(Boolean).join('\n'),
      imagePath: idea.imagePath,
      imageUrl: idea.imageUrl,
      spec: designIdea.analyzedSpec || null,
    };
  }
  if (idea.hasImage || idea.imageUrl) {
    return {
      direction: idea.notes || 'Match the uploaded reference aesthetic',
      imagePath: idea.imagePath,
      imageUrl: idea.imageUrl,
      spec: null,
    };
  }
  return null;
};

module.exports = {
  resolveDesignIdeaPath,
  toPublicImageUrl,
  normalizeDesignIdea,
  buildStoredDesignIdeaContext,
  UPLOAD_DIR,
};
