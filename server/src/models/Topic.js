const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  topic: { type: String, required: true },
  source: { type: String, enum: ['trend', 'competitor', 'gap', 'internal', 'manual'], default: 'trend' },
  volume: { type: Number, default: 0 },
  competition: { type: Number, default: 0 },
  growth: { type: Number, default: 0 },
  relevance: { type: Number, default: 0 },
  competitor: String,
  format: String,
  engagement: Number,
  status: { type: String, enum: ['active', 'used', 'archived'], default: 'active' },
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

topicSchema.index({ workspace: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Topic', topicSchema);
