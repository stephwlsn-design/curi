const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { authenticate } = require('../middleware/auth');
const { acceptPendingInvite } = require('../services/userService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  plan: user.plan,
  credits: user.credits,
  currentWorkspace: user.currentWorkspace,
});

const validationError = (res, errors) => res.status(400).json({
  error: errors.array()[0]?.msg || 'Validation failed',
  errors: errors.array(),
});

router.get('/invite/:token', async (req, res) => {
  const workspace = await Workspace.findOne({ 'pendingInvites.token': req.params.token })
    .select('name pendingInvites');
  if (!workspace) return res.status(404).json({ error: 'Invite not found or expired' });

  const invite = workspace.pendingInvites.find(i => i.token === req.params.token);
  res.json({
    workspaceName: workspace.name,
    email: invite.email,
    role: invite.role,
  });
});

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return validationError(res, errors);

  const { name, email, password, inviteToken } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const user = await User.create({ name, email, password });

  let workspace = null;
  if (inviteToken) {
    workspace = await acceptPendingInvite(user, inviteToken);
    if (!workspace) {
      await User.findByIdAndDelete(user._id);
      return res.status(400).json({ error: 'Invalid invite — email must match the invitation' });
    }
  } else {
    workspace = await Workspace.create({ name: `${name}'s Brand`, owner: user._id });
    user.currentWorkspace = workspace._id;
    await user.save();
  }

  const token = signToken(user._id);
  res.status(201).json({ token, user: formatUser(user), workspace });
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return validationError(res, errors);

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  user.lastActiveAt = new Date();
  await user.save();

  let workspace = user.currentWorkspace
    ? await findAccessibleWorkspace(user.currentWorkspace, user._id)
    : null;

  if (!workspace) {
    workspace = await findAccessibleWorkspace(null, user._id);
    if (workspace) {
      user.currentWorkspace = workspace._id;
      await user.save();
    }
  }

  const token = signToken(user._id);
  res.json({ token, user: formatUser(user), workspace });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  const workspace = user.currentWorkspace
    ? await findAccessibleWorkspace(user.currentWorkspace, user._id)
    : await findAccessibleWorkspace(null, user._id);
  res.json({ user: formatUser(user), workspace });
});

router.patch('/me', authenticate, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return validationError(res, errors);

  const updates = {};
  if (req.body.name) updates.name = req.body.name;
  if (req.body.preferences) updates.preferences = req.body.preferences;

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ user: formatUser(user) });
});

module.exports = router;
