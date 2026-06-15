const mongoose = require('mongoose');

const workflowDraftSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  currentStep: { type: String, default: 'discover' },
  currentPath: { type: String, default: '/discover' },
  coreWorkflow: {
    contentId: String,
    contentText: String,
    topic: String,
    discoverComplete: Boolean,
    createSaved: Boolean,
  },
  modules: mongoose.Schema.Types.Mixed,
  contentRefs: [{
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
    type: String,
    module: String,
  }],
  status: { type: String, enum: ['draft', 'archived'], default: 'draft', index: true },
}, { timestamps: true });

workflowDraftSchema.index({ workspace: 1, createdBy: 1, updatedAt: -1 });

module.exports = mongoose.model('WorkflowDraft', workflowDraftSchema);
