const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const verifyContent = async (contentId, workspaceId, userId) => {
  const workspace = await findAccessibleWorkspace(workspaceId, userId);
  if (!workspace) return null;
  return Content.findOne({ _id: contentId, workspace: workspaceId });
};

router.get('/queue', async (req, res) => {
  const { workspaceId, status = 'review' } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const filter = { workspace: workspaceId };
  if (status !== 'all') filter.status = status;

  const items = await Content.find(filter)
    .sort({ createdAt: -1 }).limit(50);
  res.json({ items });
});

router.post('/submit/:id', async (req, res) => {
  const item = await verifyContent(req.params.id, req.body.workspaceId, req.user._id);
  if (!item) return res.status(404).json({ error: 'Content not found' });

  item.status = 'review';
  await item.save();
  res.json({ item });
});

router.post('/approve/:id', async (req, res) => {
  const item = await verifyContent(req.params.id, req.body.workspaceId, req.user._id);
  if (!item) return res.status(404).json({ error: 'Content not found' });

  item.status = 'approved';
  item.approvedBy = req.user._id;
  item.approvedAt = new Date();
  await item.save();
  res.json({ item });
});

router.post('/reject/:id', async (req, res) => {
  const { reason, workspaceId } = req.body;
  const item = await verifyContent(req.params.id, workspaceId, req.user._id);
  if (!item) return res.status(404).json({ error: 'Content not found' });

  item.status = 'draft';
  item.metadata = { ...(item.metadata?.toObject?.() ?? item.metadata ?? {}), rejectionReason: reason };
  item.markModified('metadata');
  await item.save();
  res.json({ item });
});

router.post('/publish/:id', async (req, res) => {
  const item = await Content.findOne({
    _id: req.params.id,
    workspace: req.body.workspaceId,
    status: 'approved',
  });
  if (!item) return res.status(404).json({ error: 'Approved content not found' });

  const workspace = await findAccessibleWorkspace(req.body.workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  item.status = 'scheduled';
  item.scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : new Date();
  await item.save();
  res.json({ item });
});

module.exports = router;
