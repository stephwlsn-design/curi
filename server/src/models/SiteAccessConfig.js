const mongoose = require('mongoose');

const siteAccessConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true, index: true },
  username: { type: String, required: true },
  accessCode: { type: String, required: true },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SiteAccessConfig', siteAccessConfigSchema);
