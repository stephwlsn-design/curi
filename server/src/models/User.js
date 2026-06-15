const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  avatar: String,
  plan: { type: String, enum: ['free', 'starter', 'pro', 'agency'], default: 'free' },
  credits: { type: Number, default: 20 },
  creditsResetAt: { type: Date, default: Date.now },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  currentWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  socialAccounts: [{
    platform: { type: String, enum: ['linkedin', 'twitter', 'instagram', 'facebook', 'tiktok', 'youtube'] },
    accountId: String,
    accountName: String,
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
  }],
  emailAccounts: [{
    provider: { type: String, enum: ['mailchimp', 'klaviyo', 'activecampaign', 'hubspot', 'sendgrid', 'beehiiv'] },
    apiKey: String,
    listId: String,
    label: String,
  }],
  preferences: {
    defaultTone: { type: String, enum: ['professional', 'casual', 'witty', 'bold'], default: 'professional' },
    timezone: { type: String, default: 'UTC' },
    emailNotifications: { type: Boolean, default: true },
  },
  lastActiveAt: Date,
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.deductCredits = async function(amount) {
  this.credits = Math.max(0, this.credits - amount);
  return this.save();
};

const PLAN_CREDITS = { free: 20, starter: 500, pro: 2000, agency: 10000 };
userSchema.methods.resetMonthlyCredits = async function() {
  this.credits = PLAN_CREDITS[this.plan];
  this.creditsResetAt = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
