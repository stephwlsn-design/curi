const express = require('express');
const router = express.Router();
const { checkCredits } = require('../middleware/auth');
const { analyzeCompetitor } = require('../services/moduleService');
const { analyzeWebsite } = require('../services/discoverService');
const { saveCompetitorAnalysis } = require('../services/growthService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

router.post('/analyze', checkCredits(10), async (req, res) => {
  const { workspaceId, competitorUrl, competitorName } = req.body;
  if (!competitorUrl && !competitorName) return res.status(400).json({ error: 'Competitor URL or name required' });

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  let competitorIntel = null;
  if (competitorUrl?.trim()) {
    try {
      const scraped = await analyzeWebsite(competitorUrl.trim());
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

  const result = await analyzeCompetitor({
    brandProfile: workspace.brandProfile,
    competitorUrl,
    competitorName,
    competitorIntel,
  });
  await req.user.deductCredits(req.creditCost);

  res.json({ analysis: result, scraped: Boolean(competitorIntel) });
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
