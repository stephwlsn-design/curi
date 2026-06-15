const express = require('express');
const router = express.Router();

// TODO: Implement mail routes
router.get('/', (req, res) => res.json({ module: 'mail', status: 'coming soon' }));

module.exports = router;
