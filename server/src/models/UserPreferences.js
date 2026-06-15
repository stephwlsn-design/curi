const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  styles: [{ name: String, weight: { type: Number, default: 1 } }],
  formats: [{ name: String, weight: { type: Number, default: 1 } }],
  channels: [{ name: String, weight: { type: Number, default: 1 } }],
  themes: [{ name: String, weight: { type: Number, default: 1 } }],
  templateUsage: [{ templateId: String, count: { type: Number, default: 0 }, saves: { type: Number, default: 0 } }],
  creativePerformance: [{ type: String, avgScore: Number, count: Number }],
}, { timestamps: true });

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
