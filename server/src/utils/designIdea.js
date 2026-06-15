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
  };
};

module.exports = { resolveDesignIdeaPath, toPublicImageUrl, normalizeDesignIdea, UPLOAD_DIR };
