/** Grow+ catalog — separate from AI credits. Prices use USD list; INR equivalents from SRS. */

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', phase: 1 },
  { id: 'facebook', label: 'Facebook', phase: 1 },
  { id: 'youtube', label: 'YouTube', phase: 1 },
  { id: 'tiktok', label: 'TikTok', phase: 1 },
  { id: 'linkedin', label: 'LinkedIn', phase: 1 },
  { id: 'twitter', label: 'X', phase: 2 },
  { id: 'pinterest', label: 'Pinterest', phase: 2 },
  { id: 'threads', label: 'Threads', phase: 2 },
];

const OBJECTIVES = [
  { id: 'followers', label: 'Followers', desc: 'Profile discovery & relevant follows' },
  { id: 'engagement', label: 'Engagement', desc: 'Likes, comments, saves & shares' },
  { id: 'profile_visits', label: 'Profile visits', desc: 'Drive qualified profile traffic' },
  { id: 'video_views', label: 'Video views', desc: 'Reach for short & long-form video' },
  { id: 'reach', label: 'Reach', desc: 'Expand audience exposure' },
  { id: 'website_traffic', label: 'Website traffic', desc: 'Clicks to your site or landing page' },
  { id: 'leads', label: 'Leads', desc: 'Form fills & high-intent actions' },
  { id: 'creator_amplification', label: 'Creator amplification', desc: 'Creator distribution + paid blend' },
];

const CHANNELS = [
  { id: 'paid_social', label: 'Paid social', pct: 60 },
  { id: 'creator', label: 'Creator distribution', pct: 20 },
  { id: 'optimization', label: 'Optimization & tech', pct: 10 },
  { id: 'platform', label: 'Curi Grow+ service', pct: 10 },
];

/** One-time growth campaign packages */
const CAMPAIGN_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 59,
    priceInr: 4999,
    growthCredits: 5000,
    durationDays: 14,
    platforms: ['instagram', 'facebook'],
    bestFor: 'Initial profile growth',
    outcomes: '500–1,200 profile visits · 80–250 relevant followers (range, not guaranteed)',
    features: ['Single platform focus', 'Paid social + discovery', 'Campaign dashboard', 'Quality monitoring'],
  },
  {
    id: 'growth',
    name: 'Growth',
    priceUsd: 119,
    priceInr: 9999,
    growthCredits: 10000,
    durationDays: 30,
    platforms: ['instagram', 'facebook', 'youtube'],
    bestFor: 'Consistent acquisition',
    outcomes: '1.5K–4K profile visits · 250–700 relevant followers',
    features: ['Multi-channel acquisition', 'Audience targeting', 'Weekly optimization', 'Make-good review'],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 299,
    priceInr: 24999,
    growthCredits: 25000,
    durationDays: 45,
    platforms: ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin'],
    bestFor: 'Multi-campaign growth',
    outcomes: '5K–12K profile visits · 700–2K relevant followers',
    features: ['Cross-platform mix', 'Creator shortlist', 'Advanced reporting', 'Priority support'],
  },
  {
    id: 'scale',
    name: 'Scale',
    priceUsd: 599,
    priceInr: 49999,
    growthCredits: 50000,
    durationDays: 60,
    platforms: ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin'],
    bestFor: 'Multi-platform scale',
    outcomes: '12K–30K profile visits · 2K–5K relevant followers',
    features: ['Full platform adapters', 'Creator marketplace access', 'Dedicated optimization', 'Agency-ready reports'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: null,
    priceInr: 100000,
    growthCredits: null,
    durationDays: 90,
    platforms: PLATFORMS.filter((p) => p.phase === 1).map((p) => p.id),
    bestFor: 'Managed growth',
    outcomes: 'Custom acquisition targets & SLAs',
    features: ['Managed campaigns', 'White-label reporting', 'Multi-account', 'Custom margin guardrails'],
    custom: true,
  },
];

/** Monthly Grow+ subscriptions */
const SUBSCRIPTION_PLANS = [
  {
    id: 'launch',
    name: 'Launch',
    priceUsd: 99,
    priceInr: 7999,
    monthlyCredits: 8000,
    bestFor: 'Small businesses',
    features: ['Monthly growth allocation', '2 active campaigns', 'Basic analytics', 'Email support'],
  },
  {
    id: 'growth_sub',
    name: 'Growth',
    priceUsd: 249,
    priceInr: 19999,
    monthlyCredits: 20000,
    bestFor: 'Growing brands',
    features: ['Lower effective CPA', '5 active campaigns', 'Automated optimization', 'Creator marketplace'],
    popular: true,
  },
  {
    id: 'pro_sub',
    name: 'Pro',
    priceUsd: 499,
    priceInr: 39999,
    monthlyCredits: 45000,
    bestFor: 'Agencies & established brands',
    features: ['Priority campaign management', 'Unlimited campaigns', 'Cross-platform reporting', 'Agency sub-accounts'],
  },
  {
    id: 'scale_sub',
    name: 'Scale',
    priceUsd: 999,
    priceInr: 79999,
    monthlyCredits: 100000,
    bestFor: 'Large brands',
    features: ['Dedicated growth manager', 'Wholesale credit rates', 'White-label client reports', 'API access (beta)'],
  },
];

const TARGET_MULTIPLE_MIN = 2.5;
const TARGET_MULTIPLE_MAX = 3.0;
const MIN_GROSS_MARGIN_PCT = 55;

const assertMinimumMargin = (budgetUsd) => {
  const directCostUsd = Math.round(budgetUsd / 2.75);
  const marginPct = Math.round((1 - directCostUsd / budgetUsd) * 100);
  if (marginPct < MIN_GROSS_MARGIN_PCT) {
    const err = new Error(`Package price below minimum ${MIN_GROSS_MARGIN_PCT}% gross margin threshold`);
    err.status = 400;
    throw err;
  }
  return marginPct;
};

const estimatePriceFromCost = (directCostUsd) => {
  const cost = Number(directCostUsd) || 0;
  if (cost <= 0) return { min: 0, max: 0, recommended: 0 };
  return {
    min: Math.round(cost * TARGET_MULTIPLE_MIN),
    max: Math.round(cost * TARGET_MULTIPLE_MAX),
    recommended: Math.round(cost * 2.75) - 1,
    grossMarginPct: Math.round((1 - cost / (cost * 2.75)) * 100),
  };
};

module.exports = {
  PLATFORMS,
  OBJECTIVES,
  CHANNELS,
  CAMPAIGN_PACKAGES,
  SUBSCRIPTION_PLANS,
  TARGET_MULTIPLE_MIN,
  TARGET_MULTIPLE_MAX,
  MIN_GROSS_MARGIN_PCT,
  assertMinimumMargin,
  estimatePriceFromCost,
};
