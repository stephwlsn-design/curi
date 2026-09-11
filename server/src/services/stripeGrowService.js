const logger = require('../utils/logger');
const { CAMPAIGN_PACKAGES, SUBSCRIPTION_PLANS } = require('../constants/growPlusPackages');

const findPackage = (id) => CAMPAIGN_PACKAGES.find((p) => p.id === id);
const findSubscription = (id) => SUBSCRIPTION_PLANS.find((p) => p.id === id);

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || key.includes('YOUR') || key.length < 20) return null;
  // eslint-disable-next-line global-require
  return require('stripe')(key);
};

const isStripeEnabled = () => Boolean(getStripe());

const clientBaseUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0];

const buildLineItem = ({ name, description, amountUsd, recurring }) => {
  const unitAmount = Math.round(Number(amountUsd) * 100);
  const productData = { name, description: description || 'Curi Grow+ campaign budget' };

  if (recurring) {
    return {
      price_data: {
        currency: 'usd',
        unit_amount: unitAmount,
        recurring: { interval: 'month' },
        product_data: productData,
      },
      quantity: 1,
    };
  }

  return {
    price_data: {
      currency: 'usd',
      unit_amount: unitAmount,
      product_data: productData,
    },
    quantity: 1,
  };
};

const createGrowCheckoutSession = async ({
  campaignId,
  campaignName,
  packageId,
  subscriptionPlanId,
  budgetUsd,
  guestEmail,
  userId,
}) => {
  const stripe = getStripe();
  if (!stripe) return null;

  const pkg = packageId ? findPackage(packageId) : null;
  const sub = subscriptionPlanId ? findSubscription(subscriptionPlanId) : null;
  const isSubscription = Boolean(subscriptionPlanId);
  const label = pkg?.name || sub?.name || 'Grow+ Campaign';
  const amount = budgetUsd || pkg?.priceUsd || sub?.priceUsd;

  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? 'subscription' : 'payment',
    customer_email: guestEmail || undefined,
    line_items: [buildLineItem({
      name: `Grow+ ${label}`,
      description: campaignName,
      amountUsd: amount,
      recurring: isSubscription,
    })],
    success_url: `${clientBaseUrl()}/grow?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientBaseUrl()}/grow?checkout=cancelled`,
    metadata: {
      growCampaignId: String(campaignId),
      packageId: packageId || '',
      subscriptionPlanId: subscriptionPlanId || '',
      userId: userId ? String(userId) : '',
    },
  });

  return session;
};

const retrieveCheckoutSession = async (sessionId) => {
  const stripe = getStripe();
  if (!stripe || !sessionId) return null;
  return stripe.checkout.sessions.retrieve(sessionId);
};

module.exports = {
  isStripeEnabled,
  getStripe,
  createGrowCheckoutSession,
  retrieveCheckoutSession,
};
