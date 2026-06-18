const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  name: String,
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  startedAt: Date,
  completedAt: Date,
  summary: String,
  error: String,
}, { _id: false });

const autonomousRunSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  days: { type: Number, default: 30 },
  channels: [String],
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
  progress: { type: Number, default: 0 },
  steps: [stepSchema],
  strategy: { type: mongoose.Schema.Types.ObjectId, ref: 'Strategy' },
  stats: {
    topicsFound: { type: Number, default: 0 },
    contentGenerated: { type: Number, default: 0 },
    designsGenerated: { type: Number, default: 0 },
    videosGenerated: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    scheduled: { type: Number, default: 0 },
  },
  error: String,
  completedAt: Date,
  label: String,
  designIdea: {
    notes: String,
    filename: String,
    imageUrl: String,
    analyzedDirection: String,
    analyzedSpec: { type: mongoose.Schema.Types.Mixed },
    uploadedAt: Date,
  },
  contentPrompt: { type: String, default: '' },
  processingLockAt: Date,
  pipelineState: {
    contentIndex: { type: Number, default: 0 },
    designIndex: { type: Number, default: 0 },
    videoIndex: { type: Number, default: 0 },
    designIdeaResolved: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('AutonomousRun', autonomousRunSchema);
