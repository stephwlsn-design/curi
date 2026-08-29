const express = require('express');
const router = express.Router();
const {
  getPreview,
  getSaved,
  runAnalyze,
  saveAnalysis,
} = require('../handlers/competitorFast');

router.get('/preview', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  try {
    const payload = await getPreview({ user: req.user, workspaceId });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/analyze', async (req, res) => {
  const { workspaceId } = req.body;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  try {
    const payload = await runAnalyze({ user: req.user, body: req.body });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/saved', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace is required' });

  try {
    const payload = await getSaved({ user: req.user, workspaceId });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const payload = await saveAnalysis({ user: req.user, body: req.body });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => res.json({ module: 'competitor', status: 'live' }));

module.exports = router;
