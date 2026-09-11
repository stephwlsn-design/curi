const {
  PLATFORMS,
  OBJECTIVES,
  CHANNELS,
  CAMPAIGN_PACKAGES,
  SUBSCRIPTION_PLANS,
  estimatePriceFromCost,
  assertMinimumMargin,
} = require('../constants/growPlusPackages');
const { isStripeEnabled, createGrowCheckoutSession, retrieveCheckoutSession } = require('./stripeGrowService');
const { sendGrowPurchaseConfirmation, sendGrowEnterpriseInquiry } = require('./emailService');
const { enqueueGrowCampaign } = require('./growEnqueue');
const logger = require('../utils/logger');

const getCatalog = () => ({
  platforms: PLATFORMS,
  objectives: OBJECTIVES,
  channels: CHANNELS,
  packages: CAMPAIGN_PACKAGES,
  subscriptions: SUBSCRIPTION_PLANS,
  positioning: 'Buy a growth outcome, not a bag of fake accounts.',
  guardrails: [
    'No bot followers or fake engagement',
    'OAuth-only social connections — never store passwords',
    'Policy-compliant paid social & creator distribution',
    'Quality-adjusted acquisition reporting',
  ],
  paymentsEnabled: isStripeEnabled(),
});

const findPackage = (packageId) => CAMPAIGN_PACKAGES.find((p) => p.id === packageId);
const findSubscription = (planId) => SUBSCRIPTION_PLANS.find((p) => p.id === planId);

const buildChannelAllocation = (budgetUsd) => CHANNELS.map((ch) => ({
  channel: ch.id,
  label: ch.label,
  allocatedPct: ch.pct,
  allocatedAmount: Math.round((budgetUsd || 0) * (ch.pct / 100)),
  status: 'pending',
  spend: 0,
}));

const estimateCampaign = ({
  packageId,
  subscriptionPlanId,
  customBudgetUsd,
  platforms = [],
  objective = 'followers',
  durationDays = 30,
}) => {
  let budgetUsd = Number(customBudgetUsd) || 0;
  let pkg = null;
  let sub = null;

  if (packageId) {
    pkg = findPackage(packageId);
    if (!pkg) {
      const err = new Error('Package not found');
      err.status = 404;
      throw err;
    }
    if (pkg.custom) {
      return {
        package: pkg,
        custom: true,
        message: 'Contact sales for enterprise pricing',
        estimate: null,
      };
    }
    budgetUsd = pkg.priceUsd;
  } else if (subscriptionPlanId) {
    sub = findSubscription(subscriptionPlanId);
    if (!sub) {
      const err = new Error('Subscription plan not found');
      err.status = 404;
      throw err;
    }
    budgetUsd = sub.priceUsd;
  }

  if (!budgetUsd) {
    const err = new Error('Budget or package required');
    err.status = 400;
    throw err;
  }

  assertMinimumMargin(budgetUsd);

  const directCostUsd = Math.round(budgetUsd / 2.75);
  const pricing = estimatePriceFromCost(directCostUsd);
  const platformList = platforms.length
    ? platforms
    : (pkg?.platforms || PLATFORMS.filter((p) => p.phase === 1).map((p) => p.id));

  const duration = pkg?.durationDays || durationDays;

  return {
    package: pkg,
    subscription: sub,
    objective,
    platforms: platformList,
    durationDays: duration,
    budgetUsd,
    budgetInr: pkg?.priceInr || sub?.priceInr || Math.round(budgetUsd * 83),
    growthCredits: pkg?.growthCredits || sub?.monthlyCredits || Math.round(budgetUsd * 100),
    channelAllocation: buildChannelAllocation(budgetUsd),
    pricing,
    estimatedOutcomes: pkg?.outcomes || `Budget deployed across approved channels for ${objective.replace(/_/g, ' ')}`,
    disclaimer: 'Final results vary by audience, content, and platform. Ranges are indicative, not guarantees.',
  };
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const generateInvoiceNumber = () => `GROW-${Date.now().toString(36).toUpperCase()}`;

const createCampaign = async ({
  GrowCampaign,
  workspaceId,
  userId,
  guestEmail,
  guestName,
  body,
}) => {
  const {
    name,
    packageId,
    subscriptionPlanId,
    objective = 'followers',
    platforms = [],
    socialAccount = {},
    targetGeography = 'Global',
    targetAudience = '',
    customBudgetUsd,
    linkedSocialPlatform,
  } = body;

  const isGuest = !userId;
  if (isGuest) {
    if (!isValidEmail(guestEmail)) {
      const err = new Error('Valid email is required for guest checkout');
      err.status = 400;
      throw err;
    }
  } else if (!workspaceId) {
    const err = new Error('Workspace is required');
    err.status = 400;
    throw err;
  }

  if (!name?.trim()) {
    const err = new Error('Campaign name is required');
    err.status = 400;
    throw err;
  }

  const estimate = estimateCampaign({
    packageId,
    subscriptionPlanId,
    customBudgetUsd,
    platforms,
    objective,
  });

  if (estimate.custom) {
    const err = new Error('Enterprise packages require sales contact');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const duration = estimate.durationDays || 30;
  const end = new Date(now);
  end.setDate(end.getDate() + duration);

  const enrichedSocial = {
    ...socialAccount,
    linkedPlatform: linkedSocialPlatform || socialAccount.platform,
    oauthConnected: Boolean(linkedSocialPlatform),
  };

  const doc = await GrowCampaign.create({
    isGuest,
    guestEmail: isGuest ? String(guestEmail).trim().toLowerCase() : undefined,
    guestName: isGuest ? String(guestName || '').trim() || undefined : undefined,
    workspace: workspaceId || undefined,
    createdBy: userId || undefined,
    name: name.trim(),
    status: 'pending_payment',
    purchaseType: subscriptionPlanId ? 'subscription' : (packageId ? 'package' : 'custom'),
    packageId: packageId || undefined,
    subscriptionPlanId: subscriptionPlanId || undefined,
    objective,
    platforms: estimate.platforms,
    socialAccount: enrichedSocial,
    targetGeography,
    targetAudience: targetAudience.trim(),
    budgetUsd: estimate.budgetUsd,
    budgetInr: estimate.budgetInr,
    growthCredits: estimate.growthCredits,
    durationDays: duration,
    channels: estimate.channelAllocation,
    estimatedOutcomes: {
      profileVisits: estimate.estimatedOutcomes,
      followers: estimate.package?.outcomes || estimate.estimatedOutcomes,
    },
    paymentStatus: 'pending',
    startDate: now,
    endDate: end,
    metadata: { estimate, createdFrom: 'grow_plus' },
  });

  return { campaign: doc, estimate };
};

const finalizeGrowPayment = async (GrowCampaign, campaignId) => {
  const campaign = await GrowCampaign.findById(campaignId);
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }

  if (campaign.paymentStatus === 'paid') return campaign;

  campaign.paymentStatus = 'paid';
  campaign.status = 'review';
  campaign.invoiceNumber = campaign.invoiceNumber || generateInvoiceNumber();
  await campaign.save();

  try {
    await sendGrowPurchaseConfirmation({
      campaign,
      guestEmail: campaign.guestEmail,
      guestName: campaign.guestName,
    });
  } catch (err) {
    logger.warn(`Grow+ confirmation email skipped: ${err.message}`);
  }

  return campaign;
};

const activateCampaign = async (GrowCampaign, campaignId, { userId, guestEmail } = {}) => {
  const query = { _id: campaignId };
  if (userId) {
    query.createdBy = userId;
  } else if (guestEmail) {
    query.isGuest = true;
    query.guestEmail = String(guestEmail).trim().toLowerCase();
  }

  const campaign = await GrowCampaign.findOne(query);
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }

  await finalizeGrowPayment(GrowCampaign, campaign._id);
  await enqueueGrowCampaign(campaign._id);

  return GrowCampaign.findById(campaign._id);
};

const purchaseCampaign = async ({
  GrowCampaign,
  workspaceId,
  userId,
  body,
}) => {
  const { guestEmail, guestName, enterpriseInquiry, ...campaignBody } = body || {};

  if (campaignBody.packageId === 'enterprise' && enterpriseInquiry) {
    await sendGrowEnterpriseInquiry({
      email: guestEmail,
      name: guestName,
      message: enterpriseInquiry,
      packageName: 'Enterprise',
    });
    return { message: 'Enterprise inquiry received — our team will contact you within 1 business day' };
  }

  const { campaign } = await createCampaign({
    GrowCampaign,
    workspaceId,
    userId,
    guestEmail,
    guestName,
    body: campaignBody,
  });

  if (isStripeEnabled()) {
    try {
      const session = await createGrowCheckoutSession({
        campaignId: campaign._id,
        campaignName: campaign.name,
        packageId: campaign.packageId,
        subscriptionPlanId: campaign.subscriptionPlanId,
        budgetUsd: campaign.budgetUsd,
        guestEmail: guestEmail || campaign.guestEmail,
        userId,
      });

      campaign.stripeCheckoutSessionId = session.id;
      await campaign.save();

      return {
        requiresPayment: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        campaign,
        message: 'Redirect to Stripe to complete payment',
      };
    } catch (err) {
      logger.warn(`Stripe checkout unavailable, activating in dev mode: ${err.message}`);
    }
  }

  await finalizeGrowPayment(GrowCampaign, campaign._id);
  await enqueueGrowCampaign(campaign._id);
  const activated = await GrowCampaign.findById(campaign._id);

  return {
    requiresPayment: false,
    campaign: activated,
    message: 'Campaign activated — acquisition channels deploying across selected platforms',
  };
};

const completeCheckoutSession = async (GrowCampaign, sessionId) => {
  const session = await retrieveCheckoutSession(sessionId);

  if (session) {
    const campaignId = session.metadata?.growCampaignId;
    if (!campaignId) {
      const err = new Error('Invalid checkout session');
      err.status = 400;
      throw err;
    }

    if (session.payment_status === 'paid' || session.status === 'complete') {
      await finalizeGrowPayment(GrowCampaign, campaignId);
      await enqueueGrowCampaign(campaignId);
    }

    const campaign = await GrowCampaign.findById(campaignId);
    return { campaign, sessionStatus: session.payment_status };
  }

  const campaign = await GrowCampaign.findOne({ stripeCheckoutSessionId: sessionId });
  if (campaign) {
    return { campaign, sessionStatus: campaign.paymentStatus === 'paid' ? 'paid' : 'pending' };
  }

  const err = new Error('Checkout session not found');
  err.status = 404;
  throw err;
};

const listCampaigns = async (GrowCampaign, workspaceId) => {
  const campaigns = await GrowCampaign.find({ workspace: workspaceId })
    .sort({ createdAt: -1 })
    .limit(50);
  return campaigns;
};

const listGuestCampaigns = async (GrowCampaign, email) => {
  if (!isValidEmail(email)) {
    const err = new Error('Valid email required');
    err.status = 400;
    throw err;
  }
  return GrowCampaign.find({
    isGuest: true,
    guestEmail: String(email).trim().toLowerCase(),
  }).sort({ createdAt: -1 }).limit(50);
};

const getCampaign = async (GrowCampaign, campaignId, { userId, guestEmail } = {}) => {
  const query = { _id: campaignId };
  if (userId) {
    query.createdBy = userId;
  } else if (guestEmail) {
    query.isGuest = true;
    query.guestEmail = String(guestEmail).trim().toLowerCase();
  } else {
    const err = new Error('Email or authentication required');
    err.status = 401;
    throw err;
  }

  const campaign = await GrowCampaign.findOne(query);
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }
  return campaign;
};

const pauseCampaign = async (GrowCampaign, campaignId, userId) => {
  const campaign = await GrowCampaign.findOne({ _id: campaignId, createdBy: userId });
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }
  if (!['active', 'review'].includes(campaign.status)) {
    const err = new Error('Campaign cannot be paused in current status');
    err.status = 400;
    throw err;
  }
  campaign.status = 'paused';
  if (!campaign.executionLog) campaign.executionLog = [];
  campaign.executionLog.push({ step: 'pause', detail: 'Campaign paused by user', status: 'ok', at: new Date() });
  await campaign.save();
  return campaign;
};

const resumeCampaign = async (GrowCampaign, campaignId, userId) => {
  const campaign = await GrowCampaign.findOne({ _id: campaignId, createdBy: userId });
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }
  if (campaign.status !== 'paused') {
    const err = new Error('Campaign is not paused');
    err.status = 400;
    throw err;
  }
  campaign.status = 'active';
  if (!campaign.executionLog) campaign.executionLog = [];
  campaign.executionLog.push({ step: 'resume', detail: 'Campaign resumed by user', status: 'ok', at: new Date() });
  await campaign.save();
  await enqueueGrowCampaign(campaign._id);
  return campaign;
};

const buildCampaignReport = (campaign) => ({
  generatedAt: new Date().toISOString(),
  invoiceNumber: campaign.invoiceNumber,
  campaign: {
    id: campaign._id,
    name: campaign.name,
    status: campaign.status,
    objective: campaign.objective,
    platforms: campaign.platforms,
    budgetUsd: campaign.budgetUsd,
    durationDays: campaign.durationDays,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
  },
  metrics: campaign.metrics,
  platformMetrics: campaign.platformMetrics,
  channels: campaign.channels,
  estimatedOutcomes: campaign.estimatedOutcomes,
  executionLog: campaign.executionLog,
  complianceNote: campaign.complianceNote,
});

module.exports = {
  getCatalog,
  estimateCampaign,
  createCampaign,
  activateCampaign,
  purchaseCampaign,
  finalizeGrowPayment,
  completeCheckoutSession,
  listCampaigns,
  listGuestCampaigns,
  getCampaign,
  pauseCampaign,
  resumeCampaign,
  buildCampaignReport,
  findPackage,
  findSubscription,
};
