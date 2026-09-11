const express = require('express');
const jwt = require('jsonwebtoken');
const GrowCampaign = require('../models/GrowCampaign');
const User = require('../models/User');
const growPlusService = require('../services/growPlusService');
const { listAccountsForUser } = require('../services/socialAccountService');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const catalogHandler = (_req, res) => {
  res.json(growPlusService.getCatalog());
};

const estimateHandler = (req, res) => {
  try {
    const estimate = growPlusService.estimateCampaign(req.body || {});
    res.json({ estimate });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

const resolvePurchaseContext = async (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return {};

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return {};

    const { workspaceId } = req.body || {};
    if (!workspaceId) return { userId: user._id, user };

    const workspace = await findAccessibleWorkspace(workspaceId, user._id);
    if (!workspace) return { userId: user._id, user };

    return { userId: user._id, workspaceId, user };
  } catch {
    return {};
  }
};

const purchaseHandler = async (req, res) => {
  try {
    const { userId, workspaceId } = await resolvePurchaseContext(req);
    const result = await growPlusService.purchaseCampaign({
      GrowCampaign,
      workspaceId,
      userId,
      body: req.body,
    });
    res.status(result.requiresPayment === false ? 201 : 200).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

const checkoutCompleteHandler = async (req, res) => {
  try {
    const { session_id: sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'session_id required' });

    const result = await growPlusService.completeCheckoutSession(GrowCampaign, sessionId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

const guestOrdersHandler = async (req, res) => {
  try {
    const { email } = req.query;
    const campaigns = await growPlusService.listGuestCampaigns(GrowCampaign, email);
    res.json({ campaigns });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

const publicCampaignHandler = async (req, res) => {
  try {
    const { guestEmail } = req.query;
    if (!guestEmail) return res.status(400).json({ error: 'guestEmail required' });
    const campaign = await growPlusService.getCampaign(GrowCampaign, req.params.id, { guestEmail });
    res.json({ campaign });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

const publicReportHandler = async (req, res) => {
  try {
    const { guestEmail, format } = req.query;
    if (!guestEmail) return res.status(400).json({ error: 'guestEmail required' });
    const campaign = await growPlusService.getCampaign(GrowCampaign, req.params.id, { guestEmail });
    const report = growPlusService.buildCampaignReport(campaign);
    if (format === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename="grow-plus-${campaign._id}.json"`);
      return res.type('application/json').send(JSON.stringify(report, null, 2));
    }
    res.json({ report });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

const connectedAccountsHandler = async (req, res) => {
  const accounts = listAccountsForUser(req.user);
  res.json({ accounts: accounts.filter((a) => a.connected) });
};

const router = express.Router();

router.get('/campaigns', async (req, res) => {
  const { workspaceId } = req.query;
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const campaigns = await growPlusService.listCampaigns(GrowCampaign, workspaceId);
  res.json({ campaigns });
});

router.post('/campaigns', async (req, res) => {
  const { workspaceId } = req.body || {};
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  try {
    const result = await growPlusService.createCampaign({
      GrowCampaign,
      workspaceId,
      userId: req.user._id,
      body: req.body,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/campaigns/:id/activate', async (req, res) => {
  const { workspaceId } = req.body || {};
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  try {
    const campaign = await growPlusService.activateCampaign(
      GrowCampaign,
      req.params.id,
      { userId: req.user._id },
    );
    res.json({
      campaign,
      message: 'Campaign activated — acquisition channels deploying across selected platforms',
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/campaigns/:id/pause', async (req, res) => {
  try {
    const campaign = await growPlusService.pauseCampaign(GrowCampaign, req.params.id, req.user._id);
    res.json({ campaign });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/campaigns/:id/resume', async (req, res) => {
  try {
    const campaign = await growPlusService.resumeCampaign(GrowCampaign, req.params.id, req.user._id);
    res.json({ campaign });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/campaigns/:id', async (req, res) => {
  const { workspaceId, guestEmail } = req.query;
  try {
    if (guestEmail) {
      const campaign = await growPlusService.getCampaign(GrowCampaign, req.params.id, { guestEmail });
      return res.json({ campaign });
    }

    const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const campaign = await GrowCampaign.findOne({
      _id: req.params.id,
      workspace: workspaceId,
      createdBy: req.user._id,
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/campaigns/:id/report', async (req, res) => {
  const { workspaceId, guestEmail, format } = req.query;
  try {
    let campaign;
    if (guestEmail) {
      campaign = await growPlusService.getCampaign(GrowCampaign, req.params.id, { guestEmail });
    } else {
      const workspace = await findAccessibleWorkspace(workspaceId, req.user._id);
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
      campaign = await GrowCampaign.findOne({
        _id: req.params.id,
        workspace: workspaceId,
        createdBy: req.user._id,
      });
    }
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const report = growPlusService.buildCampaignReport(campaign);
    if (format === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename="grow-plus-${campaign._id}.json"`);
      return res.type('application/json').send(JSON.stringify(report, null, 2));
    }
    res.json({ report });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/connected-accounts', connectedAccountsHandler);

router.catalogHandler = catalogHandler;
router.estimateHandler = estimateHandler;
router.purchaseHandler = purchaseHandler;
router.checkoutCompleteHandler = checkoutCompleteHandler;
router.guestOrdersHandler = guestOrdersHandler;
router.publicCampaignHandler = publicCampaignHandler;
router.publicReportHandler = publicReportHandler;

module.exports = router;
