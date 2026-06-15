const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Workspace = require('../models/Workspace');
const { mergeBrandProfile } = require('../utils/brandProfile');
const { findAccessibleWorkspace, findOwnedWorkspace } = require('../utils/workspaceAccess');
const {
  createWorkspaceUser,
  inviteUserByEmail,
  listWorkspaceUsers,
} = require('../services/userService');

const VOICES = ['professional', 'casual', 'witty', 'bold', 'authoritative', 'friendly'];

const normalizeVoice = (voice) => {
  if (!voice) return undefined;
  const v = String(voice).toLowerCase();
  return VOICES.includes(v) ? v : 'professional';
};

const validationError = (res, errors) => res.status(400).json({
  error: errors.array()[0]?.msg || 'Validation failed',
  errors: errors.array(),
});

const getWorkspace = async (req, res) => {
  const workspace = await findAccessibleWorkspace(req.query.workspaceId || req.body.workspaceId, req.user._id)
    || await findAccessibleWorkspace(null, req.user._id);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return null;
  }
  return workspace;
};

const getOwnedWorkspace = async (req, res) => {
  const workspace = await findOwnedWorkspace(req.query.workspaceId || req.body.workspaceId, req.user._id)
    || await findOwnedWorkspace(null, req.user._id);
  if (!workspace) {
    res.status(403).json({ error: 'Only the workspace owner can manage users' });
    return null;
  }
  return workspace;
};

router.get('/', async (req, res) => {
  const workspace = await getWorkspace(req, res);
  if (!workspace) return;
  res.json({ workspace, onboarding: workspace.onboarding, brandProfile: workspace.brandProfile });
});

router.post('/onboarding', async (req, res) => {
  const {
    companyName, industry, website, targetAudience,
    competitors = [], socialChannels = [], brandColors = [], brandVoice,
  } = req.body;

  const workspace = await getWorkspace(req, res);
  if (!workspace) return;

  workspace.onboarding = {
    complete: true,
    companyName,
    website,
    targetAudience,
    socialChannels,
    brandColors,
    brandVoice,
    competitors,
    completedAt: new Date(),
  };

  const profileUpdates = {};
  if (website) profileUpdates.url = website;
  if (companyName) profileUpdates.name = companyName;
  if (industry) profileUpdates.industry = industry;
  if (targetAudience) profileUpdates.audience = targetAudience;
  if (brandVoice) profileUpdates.voice = normalizeVoice(brandVoice);
  if (competitors.length) profileUpdates.competitors = competitors;
  if (brandColors.length) profileUpdates.colors = { palette: brandColors };

  workspace.brandProfile = mergeBrandProfile(workspace.brandProfile, profileUpdates);

  await workspace.save();
  res.json({ workspace, message: 'Brand onboarding complete' });
});

router.patch('/brand', async (req, res) => {
  const workspace = await getWorkspace(req, res);
  if (!workspace) return;

  const updates = { ...req.body };
  if (updates.voice) updates.voice = normalizeVoice(updates.voice);
  workspace.brandProfile = mergeBrandProfile(workspace.brandProfile, updates);
  await workspace.save();
  res.json({ brandProfile: workspace.brandProfile });
});

router.get('/members', async (req, res) => {
  const workspace = await getWorkspace(req, res);
  if (!workspace) return;
  const team = await listWorkspaceUsers(workspace);
  res.json(team);
});

router.post('/members/invite', [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'editor', 'viewer', 'client']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return validationError(res, errors);

  const workspace = await getOwnedWorkspace(req, res);
  if (!workspace) return;

  try {
    const result = await inviteUserByEmail({
      workspace,
      ownerId: req.user._id,
      email: req.body.email,
      role: req.body.role || 'editor',
    });
    const team = await listWorkspaceUsers(workspace);
    res.status(201).json({ ...result, team });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/members/create', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['admin', 'editor', 'viewer', 'client']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return validationError(res, errors);

  const workspace = await getOwnedWorkspace(req, res);
  if (!workspace) return;

  try {
    const user = await createWorkspaceUser({
      workspace,
      ownerId: req.user._id,
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || 'editor',
    });
    const team = await listWorkspaceUsers(workspace);
    res.status(201).json({
      message: 'User account created and added to workspace',
      user: { _id: user._id, name: user.name, email: user.email, role: req.body.role || 'editor' },
      team,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/members/:userId', [
  body('role').isIn(['admin', 'editor', 'viewer', 'client']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return validationError(res, errors);

  const workspace = await getOwnedWorkspace(req, res);
  if (!workspace) return;

  const member = workspace.members.find(m => String(m.user) === req.params.userId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  member.role = req.body.role;
  await workspace.save();

  const team = await listWorkspaceUsers(workspace);
  res.json({ message: 'Role updated', team });
});

router.delete('/members/:userId', async (req, res) => {
  const workspace = await getOwnedWorkspace(req, res);
  if (!workspace) return;

  workspace.members = workspace.members.filter(m => String(m.user) !== req.params.userId);
  await workspace.save();

  const team = await listWorkspaceUsers(workspace);
  res.json({ message: 'Member removed', team });
});

router.delete('/invites/:email', async (req, res) => {
  const workspace = await getOwnedWorkspace(req, res);
  if (!workspace) return;

  const email = req.params.email.toLowerCase();
  workspace.pendingInvites = (workspace.pendingInvites || []).filter(i => i.email !== email);
  await workspace.save();

  const team = await listWorkspaceUsers(workspace);
  res.json({ message: 'Invite cancelled', team });
});

module.exports = router;
