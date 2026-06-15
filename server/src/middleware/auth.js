const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requirePlan = (...plans) => (req, res, next) => {
  if (!plans.includes(req.user.plan)) {
    return res.status(403).json({ error: `This feature requires: ${plans.join(' or ')} plan` });
  }
  next();
};

const checkCredits = (cost = 1) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const user = await User.findById(req.user._id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.credits < cost) {
    return res.status(402).json({ error: 'Insufficient credits', required: cost, available: user.credits });
  }
  req.user = user;
  req.creditCost = cost;
  next();
};

module.exports = { authenticate, requirePlan, checkCredits };
