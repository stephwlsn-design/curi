const mongoose = require('mongoose');

const calendarEntrySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  day: { type: Number, required: true },
  date: Date,
  platform: String,
  type: String,
  topic: String,
  caption: String,
  publishTime: String,
  content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
  strategy: { type: mongoose.Schema.Types.ObjectId, ref: 'Strategy' },
  autonomousRun: { type: mongoose.Schema.Types.ObjectId, ref: 'AutonomousRun' },
  status: { type: String, enum: ['planned', 'generated', 'scheduled', 'published'], default: 'planned' },
}, { timestamps: true });

calendarEntrySchema.index({ workspace: 1, autonomousRun: 1, day: 1 });

module.exports = mongoose.model('CalendarEntry', calendarEntrySchema);
