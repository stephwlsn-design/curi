const mongoose = require('mongoose');

const strategyItemSchema = new mongoose.Schema({
  topic: String,
  channel: String,
  format: String,
  day: Number,
  publishTime: String,
  priority: { type: Number, default: 1 },
}, { _id: false });

const strategySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  days: { type: Number, default: 30 },
  items: [strategyItemSchema],
  clusters: [{ name: String, topics: [String], channels: [String] }],
  status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' },
  autonomousRun: { type: mongoose.Schema.Types.ObjectId, ref: 'AutonomousRun' },
}, { timestamps: true });

module.exports = mongoose.model('Strategy', strategySchema);
