const express = require('express');
const GrowCampaign = require('../models/GrowCampaign');
const User = require('../models/User');
const growPlusService = require('../services/growPlusService');
const { getStripe } = require('../services/stripeGrowService');
const { enqueueGrowCampaign } = require('../services/growEnqueue');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/stripe', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const campaignId = session.metadata?.growCampaignId;
      if (campaignId) {
        const campaign = await GrowCampaign.findById(campaignId);
        if (campaign && campaign.paymentStatus !== 'paid') {
          campaign.stripeCheckoutSessionId = session.id;
          campaign.stripePaymentIntentId = session.payment_intent || undefined;
          campaign.stripeSubscriptionId = session.subscription || undefined;
          await campaign.save();
          await growPlusService.finalizeGrowPayment(GrowCampaign, campaignId);
          await enqueueGrowCampaign(campaignId);
          logger.info(`Grow+ payment completed for campaign ${campaignId}`);
        }
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object;
      const user = await User.findOne({ stripeCustomerId: sub.customer });
      if (user?.subscription) {
        user.subscription.status = sub.status;
        user.subscription.stripeSubscriptionId = sub.id;
        user.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
        if (typeof user.updatePlanLimits === 'function') user.updatePlanLimits();
        await user.save();
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = await User.findOne({ stripeCustomerId: sub.customer });
      if (user?.subscription) {
        user.subscription.plan = 'free';
        user.subscription.status = 'cancelled';
        if (typeof user.updatePlanLimits === 'function') user.updatePlanLimits();
        await user.save();
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

module.exports = router;
