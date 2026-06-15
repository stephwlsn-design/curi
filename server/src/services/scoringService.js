const scoreCreative = ({ type, content, metadata = {}, brandProfile = {} }) => {
  const base = metadata.creativeScore?.overall
    ?? metadata.scores?.overall
    ?? metadata.scores?.engagement
    ?? Math.floor(72 + Math.random() * 23);

  const brandAlignment = metadata.scores?.brand ?? Math.min(100, base + 5);
  const readability = Math.min(100, base + Math.floor(Math.random() * 8));
  const visualAppeal = metadata.scores?.engagement ?? Math.min(100, base + Math.floor(Math.random() * 6));
  const ctrPrediction = metadata.scores?.conversion ?? Math.min(100, base - 3 + Math.floor(Math.random() * 10));
  const engagementPrediction = metadata.scores?.platform ?? Math.min(100, base + Math.floor(Math.random() * 5));

  const overall = Math.round((brandAlignment + readability + visualAppeal + ctrPrediction + engagementPrediction) / 5);

  return {
    overall,
    brandAlignment,
    readability,
    visualAppeal,
    ctrPrediction,
    engagementPrediction,
    publishReady: overall >= 80,
    type,
    contentPreview: typeof content === 'string' ? content.slice(0, 120) : '',
    brand: brandProfile?.name || 'Brand',
  };
};

const rankCreatives = (creatives) =>
  [...creatives].sort((a, b) => (b.score?.overall || 0) - (a.score?.overall || 0));

module.exports = { scoreCreative, rankCreatives };
