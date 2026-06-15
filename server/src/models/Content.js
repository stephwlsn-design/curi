const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['post', 'image', 'video', 'email', 'blog', 'ad', 'campaign'], required: true },
  platform: { type: String, enum: ['linkedin', 'twitter', 'instagram', 'facebook', 'tiktok', 'youtube', 'email', 'universal'] },
  title: String,
  content: String,
  mediaUrl: String,
  thumbnailUrl: String,
  hashtags: [String],
  emojis: [String],
  metadata: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'failed'], default: 'draft' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  scheduledAt: Date,
  publishedAt: Date,
  publishError: String,
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  calendarEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'CalendarEntry' },
  analytics: {
    impressions: Number, clicks: Number, likes: Number,
    shares: Number, comments: Number, saves: Number, reach: Number,
  },
}, { timestamps: true });

contentSchema.index({ workspace: 1, status: 1 });
contentSchema.index({ workspace: 1, platform: 1, scheduledAt: 1 });

module.exports = mongoose.model('Content', contentSchema);
