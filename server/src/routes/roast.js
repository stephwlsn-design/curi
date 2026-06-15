const express = require('express');
const { body, validationResult } = require('express-validator');
const { discoverBrand, scrapeWebsite, extractFromHtml } = require('../services/ai/discoverService');
const { roastWebsite } = require('../services/ai/aiService');
const router = express.Router();

// POST /api/roast — public, no auth required
router.post('/', [
  body('url').isURL({ require_protocol: true }).withMessage('Valid URL required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { url } = req.body;
    const html = await scrapeWebsite(url);
    const extracted = extractFromHtml(html, url);
    const roast = await roastWebsite({ url, extractedContent: extracted });
    res.json({ url, roast, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
