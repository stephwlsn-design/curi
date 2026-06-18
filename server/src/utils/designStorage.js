const DATA_URL_PLACEHOLDER = '__design_reference__';

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

const replaceDataUrls = (value, placeholder = DATA_URL_PLACEHOLDER) => {
  if (isDataUrl(value)) return placeholder;
  return value;
};

/** Strip embedded base64 from canvas JSON so Content documents stay under MongoDB limits. */
const compactCanvasForStorage = (canvas) => {
  if (!canvas || typeof canvas !== 'object') return canvas;
  const out = { ...canvas };
  if (out.background && typeof out.background === 'object') {
    out.background = {
      ...out.background,
      url: replaceDataUrls(out.background.url),
      textureUrl: replaceDataUrls(out.background.textureUrl),
    };
  }
  out.referenceImageUrl = replaceDataUrls(out.referenceImageUrl);
  if (Array.isArray(out.elements)) {
    out.elements = out.elements.map((el) => (
      el?.type === 'image' && isDataUrl(el.src)
        ? { ...el, src: DATA_URL_PLACEHOLDER }
        : el
    ));
  }
  return out;
};

const compactDesignMetadataForStorage = ({
  design,
  canvasLayout,
  designIdeaContext,
  runDesignIdea,
}) => {
  const compactCanvas = compactCanvasForStorage(canvasLayout);
  const spec = designIdeaContext?.spec
    ? {
      colorPalette: designIdeaContext.spec.colorPalette,
      layout: designIdeaContext.spec.layout,
      backgroundMode: designIdeaContext.spec.backgroundMode,
      backgroundColor: designIdeaContext.spec.backgroundColor,
      typography: designIdeaContext.spec.typography,
      aestheticOnly: true,
    }
    : undefined;

  const designIdeaRef = (runDesignIdea?.notes || runDesignIdea?.previewDataUrl || runDesignIdea?.imageUrl)
    ? {
      notes: runDesignIdea.notes || '',
      hasReferenceImage: Boolean(runDesignIdea.previewDataUrl || runDesignIdea.imageUrl),
      analyzedDirection: runDesignIdea.analyzedDirection || designIdeaContext?.direction?.slice(0, 300),
      spec,
    }
    : undefined;

  return {
    name: design.name,
    headline: design.headline,
    subheadline: design.subheadline,
    cta: design.cta,
    layout: design.layout,
    typography: design.typography,
    colorPalette: design.colorPalette,
    compositionNotes: design.compositionNotes,
    designIdeaApplied: design.designIdeaApplied,
    referenceImageUrl: replaceDataUrls(design.referenceImageUrl || designIdeaContext?.imageUrl),
    canvasLayout: compactCanvas,
    designIdeaRef,
    usesDesignReference: Boolean(designIdeaRef?.hasReferenceImage || spec),
  };
};

const isResolvableReference = (value) => (
  typeof value === 'string'
  && value.length > 0
  && value !== DATA_URL_PLACEHOLDER
);

const hydrateCanvasWithReference = (canvas, referenceUrl) => {
  if (!canvas || !isResolvableReference(referenceUrl)) return canvas;
  const out = { ...canvas };
  if (out.background?.url === DATA_URL_PLACEHOLDER) {
    out.background = { ...out.background, url: referenceUrl };
  }
  if (out.background?.textureUrl === DATA_URL_PLACEHOLDER) {
    out.background = { ...out.background, textureUrl: referenceUrl };
  }
  if (out.referenceImageUrl === DATA_URL_PLACEHOLDER || !out.referenceImageUrl) {
    out.referenceImageUrl = referenceUrl;
  }
  if (Array.isArray(out.elements)) {
    out.elements = out.elements.map((el) => (
      el?.src === DATA_URL_PLACEHOLDER ? { ...el, src: referenceUrl } : el
    ));
  }
  return out;
};

const hydrateDesignContent = (content, runDesignIdea) => {
  if (!content) return content;
  const doc = content.toObject ? content.toObject() : { ...content };
  const ref = runDesignIdea?.previewDataUrl || runDesignIdea?.imageUrl;
  if (!ref) return doc;

  doc.metadata = doc.metadata || {};
  if (doc.metadata.canvasLayout) {
    doc.metadata.canvasLayout = hydrateCanvasWithReference(doc.metadata.canvasLayout, ref);
  }
  if (
    doc.metadata.referenceImageUrl === DATA_URL_PLACEHOLDER
    || !doc.metadata.referenceImageUrl
    || doc.metadata.canvasLayout?.designIdeaBased
  ) {
    doc.metadata.referenceImageUrl = ref;
  }
  if (doc.metadata.canvasLayout) {
    doc.metadata.canvasLayout.referenceImageUrl = ref;
    doc.metadata.canvasLayout.designIdeaBased = true;
  }
  return doc;
};

module.exports = {
  DATA_URL_PLACEHOLDER,
  compactCanvasForStorage,
  compactDesignMetadataForStorage,
  hydrateCanvasWithReference,
  hydrateDesignContent,
};
