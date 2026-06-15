const express = require('express');
const router = express.Router();

// TODO: Implement billing routes
router.get('/', (req, res) => res.json({ module: 'billing', status: 'coming soon' }));

module.exports = router;
