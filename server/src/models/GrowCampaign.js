const mongoose = require('mongoose');

const growCampaignSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isGuest: { type: Boolean, default: false },
  guestEmail: { type: String, lowercase: true, trim: true },
  guestName: { type: String, trim: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['draft', 'pending_payment', 'review', 'active', 'paused', 'completed', 'cancelled'],
    default: 'pending_payment',
  },
  purchaseType: { type: String, enum: ['package', 'subscription', 'custom'], default: 'package' },
  packageId: String,
  subscriptionPlanId: String,
  objective: { type: String, default: 'followers' },
  platforms: [{ type: String }],
  socialAccount: {
    platform: String,
    handle: String,
    profileUrl: String,
    linkedPlatform: String,
    oauthConnected: { type: Boolean, default: false },
  },
  targetGeography: { type: String, default: 'Global' },
  targetAudience: String,
  budgetUsd: Number,
  budgetInr: Number,
  growthCredits: Number,
  durationDays: Number,
  channels: [{
    channel: String,
    label: String,
    allocatedPct: Number,
    allocatedAmount: Number,
    status: { type: String, default: 'pending' },
    spend: { type: Number, default: 0 },
  }],
  estimatedOutcomes: {
    profileVisits: String,
    followers: String,
    engagement: String,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  stripeCheckoutSessionId: String,
  stripePaymentIntentId: String,
  stripeSubscriptionId: String,
  invoiceNumber: String,
  metrics: {
    spend: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    profileVisits: { type: Number, default: 0 },
    followersGained: { type: Number, default: 0 },
    engagements: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0 },
    costPerFollower: { type: Number, default: 0 },
    progressPct: { type: Number, default: 0 },
  },
  platformMetrics: [{
    platform: String,
    spend: Number,
    reach: Number,
    impressions: Number,
    followersGained: Number,
    engagements: Number,
    sharePct: Number,
    channel: String,
  }],
  executionLog: [{
    step: String,
    detail: String,
    status: { type: String, default: 'ok' },
    at: Date,
  }],
  complianceNote: {
    type: String,
    default: 'Real audience acquisition only — no bots, fake accounts, or policy violations.',
  },
  startDate: Date,
  endDate: Date,
  deployedAt: Date,
  lastMetricsSync: Date,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

growCampaignSchema.index({ workspace: 1, status: 1 });
growCampaignSchema.index({ createdBy: 1, createdAt: -1 });
growCampaignSchema.index({ guestEmail: 1, createdAt: -1 });
growCampaignSchema.index({ stripeCheckoutSessionId: 1 });

module.exports = mongoose.model('GrowCampaign', growCampaignSchema);
