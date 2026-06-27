const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { analyzeCompetitor } = require('../services/moduleService');
const { analyzeWebsite } = require('../services/discoverService');
const { saveCompetitorAnalysis } = require('../services/growthService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { resolveCompetitorTarget, listWorkspaceCompetitors } = require('../utils/workspaceGrowth');
const { buildFallbackCompetitorAnalysis } = require('../utils/growthFallbacks');
const WorkflowDraft = require('../models/WorkflowDraft');

const COMPETITOR_ANALYSIS_COST = 10;

router.get('/preview', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const target = resolveCompetitorTarget(workspace, {});
  const analysis = buildFallbackCompetitorAnalysis(workspace.brandProfile, target.competitorName);

  res.json({
    analysis,
    competitorUrl: target.competitorUrl,
    competitorName: target.competitorName || analysis.competitor,
    source: 'preview',
    competitors: listWorkspaceCompetitors(workspace),
  });
});

router.post('/analyze', async (req, res) => {
  const { workspaceId, competitorUrl, competitorName } = req.body;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const target = resolveCompetitorTarget(workspace, { competitorUrl, competitorName });
  const user = await User.findById(req.user._id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const canCharge = user.credits >= COMPETITOR_ANALYSIS_COST;

  try {
    let competitorIntel = null;
    if (canCharge && target.competitorUrl) {
      try {
        const scraped = await analyzeWebsite(target.competitorUrl);
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
      await user.deductCredits(COMPETITOR_ANALYSIS_COST);
    }

    res.json({
      analysis: result,
      scraped: Boolean(competitorIntel),
      competitorUrl: target.competitorUrl,
      competitorName: target.competitorName || result?.competitor,
      source: result?.source || (canCharge ? 'ai' : 'fallback'),
      competitors: listWorkspaceCompetitors(workspace),
      ...(canCharge ? {} : {
        warning: `Showing profile-based analysis — ${COMPETITOR_ANALYSIS_COST} credits required for a live AI scan`,
      }),
    });
  } catch (err) {
    const analysis = buildFallbackCompetitorAnalysis(workspace.brandProfile, target.competitorName);
    res.json({
      analysis,
      scraped: false,
      competitorUrl: target.competitorUrl,
      competitorName: target.competitorName || analysis.competitor,
      source: 'fallback',
      competitors: listWorkspaceCompetitors(workspace),
      warning: err.message || 'Live analysis unavailable — showing profile-based report',
    });
  }
});

router.get('/saved', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const draft = await WorkflowDraft.findOne({
    workspace: workspaceId,
    'modules.competitor.analysis': { $exists: true },
    status: 'draft',
  }).sort({ updatedAt: -1 }).lean();

  const competitor = draft?.modules?.competitor;
  res.json({
    analysis: competitor?.analysis || null,
    competitorUrl: competitor?.url || '',
    competitorName: competitor?.name || competitor?.analysis?.competitor || '',
    competitors: listWorkspaceCompetitors(workspace),
    savedAt: competitor?.savedAt || draft?.updatedAt || null,
  });
});

router.post('/save', async (req, res) => {
  const { workspaceId, analysis, competitorUrl, competitorName } = req.body;
  if (!analysis) return res.status(400).json({ error: 'Analysis is required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const draft = await saveCompetitorAnalysis({
    workspaceId: workspace._id,
    userId: req.user._id,
    analysis,
    competitorUrl,
    competitorName,
  });

  res.json({ draft, message: 'Analysis saved to Brand Hub drafts' });
});

router.get('/', async (req, res) => res.json({ module: 'competitor', status: 'live' }));

module.exports = router;
