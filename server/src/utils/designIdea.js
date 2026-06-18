const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../middleware/upload');

const MAX_PREVIEW_BYTES = 900_000;
const ANALYSIS_TIMEOUT_MS = process.env.VERCEL ? 18_000 : 30_000;

const buildImageDataUrl = (buffer, mime = 'image/jpeg') => (
  `data:${mime};base64,${buffer.toString('base64')}`
);

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
};

const resolveDesignIdeaPath = (designIdea) => {
  if (!designIdea) return null;
  if (designIdea.imagePath && fs.existsSync(designIdea.imagePath)) return designIdea.imagePath;
  if (designIdea.filename) {
    const filePath = path.join(UPLOAD_DIR, path.basename(designIdea.filename));
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
};

const materializeDesignIdeaImage = (designIdea) => {
  const existing = resolveDesignIdeaPath(designIdea);
  if (existing) return existing;

  const dataUrl = designIdea?.previewDataUrl || designIdea?.imageDataUrl;
  if (!dataUrl) return null;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = parsed.mime.includes('png')
    ? '.png'
    : parsed.mime.includes('webp')
      ? '.webp'
      : parsed.mime.includes('gif')
        ? '.gif'
        : '.jpg';
  const filename = designIdea.filename
    ? path.basename(designIdea.filename)
    : `materialized-${Date.now()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, parsed.buffer);
  return filePath;
};

const toPublicImageUrl = (filename) => `/api/uploads/design-ideas/${path.basename(filename)}`;

const normalizeDesignIdea = (designIdea = {}) => {
  const notes = String(designIdea.notes || '').trim();
  const filename = designIdea.filename ? path.basename(designIdea.filename) : null;
  const imagePath = materializeDesignIdeaImage({ ...designIdea, filename })
    || resolveDesignIdeaPath({ ...designIdea, filename });
  const hasStoredImage = Boolean(designIdea.previewDataUrl || designIdea.imageDataUrl);
  return {
    notes,
    filename,
    imageUrl: designIdea.imageUrl || (filename ? toPublicImageUrl(filename) : null),
    previewDataUrl: designIdea.previewDataUrl || designIdea.imageDataUrl || null,
    imagePath,
    hasImage: Boolean(imagePath || hasStoredImage),
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
      imageUrl: idea.previewDataUrl || idea.imageUrl,
      spec: designIdea.analyzedSpec,
    };
  }
  if (designIdea.analyzedDirection || idea.notes || idea.imageUrl || idea.previewDataUrl) {
    return {
      direction: [designIdea.analyzedDirection, idea.notes].filter(Boolean).join('\n'),
      imagePath: idea.imagePath,
      imageUrl: idea.previewDataUrl || idea.imageUrl,
      spec: designIdea.analyzedSpec || null,
    };
  }
  if (idea.hasImage || idea.imageUrl || idea.previewDataUrl) {
    return {
      direction: idea.notes || 'Match the uploaded reference aesthetic',
      imagePath: idea.imagePath,
      imageUrl: idea.previewDataUrl || idea.imageUrl,
      spec: null,
    };
  }
  return null;
};

const attachPreviewFromBuffer = (designIdea, buffer, mime = 'image/jpeg') => {
  if (!buffer?.length || buffer.length > MAX_PREVIEW_BYTES) return designIdea;
  return {
    ...designIdea,
    previewDataUrl: buildImageDataUrl(buffer, mime),
  };
};

const analyzeDesignIdeaIfNeeded = async (designIdea, designService) => {
  const normalized = normalizeDesignIdea(designIdea);
  if (!normalized.hasImage && !designIdea.notes?.trim()) return designIdea;
  if (
    designIdea.analyzedSpec?.aestheticOnly
    && designIdea.analyzedSpec.backgroundMode
    && designIdea.analyzedDirection
  ) {
    return designIdea;
  }
  if (!normalized.hasImage) return designIdea;

  try {
    const ideaContext = await Promise.race([
      designService.resolveDesignIdeaContext(normalizeDesignIdea(designIdea)),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Style analysis timed out')), ANALYSIS_TIMEOUT_MS);
      }),
    ]);
    if (ideaContext) {
      return {
        ...designIdea,
        analyzedDirection: ideaContext.direction,
        analyzedSpec: ideaContext.spec,
      };
    }
  } catch (err) {
    console.warn('[design] idea analysis skipped:', err.message);
  }
  return designIdea;
};

module.exports = {
  MAX_PREVIEW_BYTES,
  buildImageDataUrl,
  resolveDesignIdeaPath,
  materializeDesignIdeaImage,
  toPublicImageUrl,
  normalizeDesignIdea,
  buildStoredDesignIdeaContext,
  attachPreviewFromBuffer,
  analyzeDesignIdeaIfNeeded,
  UPLOAD_DIR,
};
