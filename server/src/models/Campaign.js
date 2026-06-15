const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  goal: String,
  status: { type: String, enum: ['generating', 'draft', 'review', 'active', 'completed'], default: 'generating' },
  type: { type: String, enum: ['launch', 'promotion', 'awareness', 'seasonal', 'custom'], default: 'custom' },
  content: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
  strategy: String,
  startDate: Date,
  endDate: Date,
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
