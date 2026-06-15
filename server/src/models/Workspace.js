const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'editor', 'viewer', 'client'], default: 'editor' },
    invitedAt: Date,
    acceptedAt: Date,
  }],
  pendingInvites: [{
    email: { type: String, lowercase: true },
    role: { type: String, enum: ['admin', 'editor', 'viewer', 'client'], default: 'editor' },
    token: String,
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
  }],
  brandProfile: {
    url: String,
    name: String,
    logo: String,
    colors: { primary: String, secondary: String, accent: String, background: String, text: String, palette: [String] },
    fonts: { heading: String, body: String },
    voice: { type: String, enum: ['professional', 'casual', 'witty', 'bold', 'authoritative', 'friendly'] },
    industry: String,
    audience: String,
    valueProposition: String,
    products: [String],
    keywords: [String],
    competitors: [String],
    marketingSummary: String,
    lastDiscoveredAt: Date,
    designIdea: {
      notes: String,
      filename: String,
      imageUrl: String,
      uploadedAt: Date,
    },
  },
  onboarding: {
    complete: { type: Boolean, default: false },
    companyName: String,
    website: String,
    targetAudience: String,
    socialChannels: [{ type: String }],
    brandColors: [String],
    brandVoice: String,
    competitors: [String],
    completedAt: Date,
  },
  settings: {
    defaultLanguage: { type: String, default: 'en' },
    defaultTimezone: { type: String, default: 'UTC' },
    clientPortalEnabled: { type: Boolean, default: false },
    clientPortalSlug: String,
  },
  stats: {
    postsGenerated: { type: Number, default: 0 },
    imagesGenerated: { type: Number, default: 0 },
    videosGenerated: { type: Number, default: 0 },
    postsPublished: { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Workspace', workspaceSchema);
