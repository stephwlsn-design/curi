const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();
// TODO: Implement full route handlers for this module
router.get('/', protect, (req, res) => res.json({ message: `${req.path} module ready` }));
router.post('/', protect, (req, res) => res.json({ message: `${req.path} module ready`, body: req.body }));
module.exports = router;
