const mongoose = require('mongoose');

const designTemplateSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  category: { type: String, default: 'custom' },
  dimensionId: { type: String, default: '1080x1080' },
  canvasLayout: mongoose.Schema.Types.Mixed,
  thumbnailColors: [String],
}, { timestamps: true });

module.exports = mongoose.model('DesignTemplate', designTemplateSchema);
