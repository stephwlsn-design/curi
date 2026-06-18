const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { mergeBrandProfile } = require('../utils/brandProfile');

const VOICES = ['professional', 'casual', 'witty', 'bold', 'authoritative', 'friendly'];

const normalizeVoice = (voice) => {
  if (!voice) return undefined;
  const v = String(voice).toLowerCase();
  return VOICES.includes(v) ? v : 'professional';
};

const resolveWorkspace = async (workspaceId, userId) => {
  if (workspaceId) {
    return findAccessibleWorkspace(workspaceId, userId);
  }
  return findAccessibleWorkspace(null, userId);
};

const getWorkspacePayload = async ({ user, workspaceId }) => {
  const workspace = await resolveWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  return {
    workspace,
    onboarding: workspace.onboarding,
    brandProfile: workspace.brandProfile,
  };
};

const saveOnboarding = async ({ user, body }) => {
  const {
    companyName,
    industry,
    website,
    targetAudience,
    competitors = [],
    socialChannels = [],
    brandColors = [],
    brandVoice,
    valueProposition,
    marketingSummary,
    workspaceId,
  } = body;

  const workspace = await resolveWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const competitorList = Array.isArray(competitors)
    ? competitors
    : String(competitors || '').split(',').map((s) => s.trim()).filter(Boolean);

  workspace.onboarding = {
    complete: true,
    companyName: companyName || workspace.onboarding?.companyName,
    industry: industry || workspace.onboarding?.industry,
    website: website || workspace.onboarding?.website,
    targetAudience: targetAudience || workspace.onboarding?.targetAudience,
    socialChannels: socialChannels.length ? socialChannels : (workspace.onboarding?.socialChannels || []),
    brandColors: brandColors.length ? brandColors : (workspace.onboarding?.brandColors || []),
    brandVoice: brandVoice || workspace.onboarding?.brandVoice,
    competitors: competitorList,
    completedAt: new Date(),
  };

  const profileUpdates = {};
  if (website) profileUpdates.url = website;
  if (companyName) profileUpdates.name = companyName;
  if (industry) profileUpdates.industry = industry;
  if (targetAudience) profileUpdates.audience = targetAudience;
  if (brandVoice) profileUpdates.voice = normalizeVoice(brandVoice);
  if (competitorList.length) profileUpdates.competitors = competitorList;
  if (brandColors.length) profileUpdates.colors = { palette: brandColors };
  if (valueProposition) profileUpdates.valueProposition = valueProposition;
  if (marketingSummary) profileUpdates.marketingSummary = marketingSummary;

  workspace.brandProfile = mergeBrandProfile(workspace.brandProfile, profileUpdates);
  await workspace.save();

  return { workspace, message: 'Brand onboarding complete' };
};

module.exports = {
  getWorkspacePayload,
  saveOnboarding,
};
