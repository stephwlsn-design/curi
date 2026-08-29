const User = require('../models/User');
const WorkflowDraft = require('../models/WorkflowDraft');
const { analyzeCompetitor } = require('../services/moduleService');
const { analyzeWebsite } = require('../services/discoverService');
const { saveCompetitorAnalysis } = require('../services/growthService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { resolveCompetitorTarget, listWorkspaceCompetitors } = require('../utils/workspaceGrowth');
const { buildFallbackCompetitorAnalysis } = require('../utils/growthFallbacks');

const COMPETITOR_ANALYSIS_COST = 10;
const SCRAPE_BUDGET_MS = process.env.VERCEL ? 5000 : 8000;
const ANALYZE_BUDGET_MS = process.env.VERCEL ? 45_000 : 60_000;

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  }),
]);

const requireWorkspace = async (workspaceId, userId) => {
  const workspace = await findAccessibleWorkspace(workspaceId, userId);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  return workspace;
};

const getPreview = async ({ user, workspaceId }) => {
  const workspace = await requireWorkspace(workspaceId, user._id);
  const target = resolveCompetitorTarget(workspace, {});
  const analysis = buildFallbackCompetitorAnalysis(workspace.brandProfile, target.competitorName);

  return {
    analysis,
    competitorUrl: target.competitorUrl,
    competitorName: target.competitorName || analysis.competitor,
    source: 'preview',
    competitors: listWorkspaceCompetitors(workspace),
  };
};

const getSaved = async ({ user, workspaceId }) => {
  const workspace = await requireWorkspace(workspaceId, user._id);

  const draft = await WorkflowDraft.findOne({
    workspace: workspaceId,
    'modules.competitor.analysis': { $exists: true },
    status: 'draft',
  }).sort({ updatedAt: -1 }).lean();

  const competitor = draft?.modules?.competitor;
  return {
    analysis: competitor?.analysis || null,
    competitorUrl: competitor?.url || '',
    competitorName: competitor?.name || competitor?.analysis?.competitor || '',
    competitors: listWorkspaceCompetitors(workspace),
    savedAt: competitor?.savedAt || draft?.updatedAt || null,
  };
};

const runAnalyze = async ({ user, body }) => {
  const { workspaceId, competitorUrl, competitorName } = body;
  const workspace = await requireWorkspace(workspaceId, user._id);
  const target = resolveCompetitorTarget(workspace, { competitorUrl, competitorName });

  const dbUser = await User.findById(user._id);
  if (!dbUser) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }

  const canCharge = dbUser.credits >= COMPETITOR_ANALYSIS_COST;

  try {
    const payload = await withTimeout((async () => {
      let competitorIntel = null;
      if (canCharge && target.competitorUrl) {
        try {
          const scraped = await withTimeout(
            analyzeWebsite(target.competitorUrl),
            SCRAPE_BUDGET_MS,
            'Competitor site scrape timed out',
          );
          competitorIntel = {
            name: scraped.name,
            tagline: scraped.tagline,
            audience: scraped.audience,
            products: scraped.products,
            colors: scraped.colors?.palette,
            keywords: scraped.keywords,
            marketingSummary: scraped.marketingSummary,
          };
        } catch {
          competitorIntel = null;
        }
      }

      const result = canCharge
        ? await analyzeCompetitor({
          brandProfile: workspace.brandProfile,
          competitorUrl: target.competitorUrl,
          competitorName: target.competitorName,
          competitorIntel,
        })
        : {
          ...buildFallbackCompetitorAnalysis(workspace.brandProfile, target.competitorName),
          source: 'fallback',
        };

      if (canCharge && result.source !== 'fallback') {
        await dbUser.deductCredits(COMPETITOR_ANALYSIS_COST);
      }

      return {
        analysis: result,
        scraped: Boolean(competitorIntel),
        competitorUrl: target.competitorUrl,
        competitorName: target.competitorName || result?.competitor,
        source: result?.source || (canCharge ? 'ai' : 'fallback'),
        competitors: listWorkspaceCompetitors(workspace),
        ...(canCharge ? {} : {
          warning: `Showing profile-based analysis — ${COMPETITOR_ANALYSIS_COST} credits required for a live AI scan`,
        }),
      };
    })(), ANALYZE_BUDGET_MS, 'Competitor analysis timed out — try again');

    return payload;
  } catch (err) {
    const analysis = buildFallbackCompetitorAnalysis(workspace.brandProfile, target.competitorName);
    return {
      analysis,
      scraped: false,
      competitorUrl: target.competitorUrl,
      competitorName: target.competitorName || analysis.competitor,
      source: 'fallback',
      competitors: listWorkspaceCompetitors(workspace),
      warning: err.message || 'Live analysis unavailable — showing profile-based report',
    };
  }
};

const saveAnalysis = async ({ user, body }) => {
  const { workspaceId, analysis, competitorUrl, competitorName } = body;
  if (!analysis) {
    const err = new Error('Analysis is required');
    err.status = 400;
    throw err;
  }

  const workspace = await requireWorkspace(workspaceId, user._id);
  const draft = await saveCompetitorAnalysis({
    workspaceId: workspace._id,
    userId: user._id,
    analysis,
    competitorUrl,
    competitorName,
  });

  return { draft, message: 'Analysis saved to drafts' };
};

module.exports = {
  getPreview,
  getSaved,
  runAnalyze,
  saveAnalysis,
};
