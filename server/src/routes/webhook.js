const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const logger = require('../utils/logger');
const router = express.Router();

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object;
      const user = await User.findOne({ stripeCustomerId: sub.customer });
      if (user) {
        user.subscription.status = sub.status;
        user.subscription.stripeSubscriptionId = sub.id;
        user.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
        user.updatePlanLimits();
        await user.save();
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = await User.findOne({ stripeCustomerId: sub.customer });
      if (user) {
        user.subscription.plan = 'free';
        user.subscription.status = 'cancelled';
        user.updatePlanLimits();
        await user.save();
      }
      break;
    }
  }
  res.json({ received: true });
});

module.exports = router;
