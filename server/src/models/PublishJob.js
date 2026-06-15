const mongoose = require('mongoose');

const publishJobSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  platform: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  predictedBestTime: Date,
  status: { type: String, enum: ['queued', 'processing', 'published', 'failed', 'cancelled'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  publishedAt: Date,
  error: String,
  externalId: String,
  autonomousRun: { type: mongoose.Schema.Types.ObjectId, ref: 'AutonomousRun' },
}, { timestamps: true });

publishJobSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('PublishJob', publishJobSchema);
