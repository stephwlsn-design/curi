const isUrlLike = (value) => /^https?:\/\//i.test(value) || /^www\./i.test(value);

const normalizeUrl = (value) => {
  const trimmed = String(value).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const listWorkspaceCompetitors = (workspace) => [
  ...(workspace?.brandProfile?.competitors || []),
  ...(workspace?.onboarding?.competitors || []),
].map((c) => String(c).trim()).filter(Boolean);

const resolveIndustry = (workspace, inputIndustry) => (
  inputIndustry?.trim()
  || workspace?.brandProfile?.industry?.trim()
  || 'General'
);

const resolveCompetitorTarget = (workspace, { competitorUrl, competitorName } = {}) => {
  const urlInput = competitorUrl?.trim();
  const nameInput = competitorName?.trim();

  if (urlInput) {
    return {
      competitorUrl: normalizeUrl(urlInput),
      competitorName: nameInput || '',
      source: 'request',
    };
  }
  if (nameInput) {
    return { competitorUrl: '', competitorName: nameInput, source: 'request' };
  }

  const competitors = listWorkspaceCompetitors(workspace);
  const first = competitors[0];
  if (first) {
    if (isUrlLike(first)) {
      return { competitorUrl: normalizeUrl(first), competitorName: '', source: 'profile' };
    }
    return { competitorUrl: '', competitorName: first, source: 'profile' };
  }

  const industry = workspace?.brandProfile?.industry?.trim() || 'your category';
  return {
    competitorUrl: '',
    competitorName: `Leading competitor in ${industry}`,
    source: 'inferred',
  };
};

module.exports = {
  listWorkspaceCompetitors,
  resolveIndustry,
  resolveCompetitorTarget,
};
