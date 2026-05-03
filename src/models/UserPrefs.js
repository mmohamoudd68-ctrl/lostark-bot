const mongoose = require('mongoose');

const userPrefsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },
  dmEnabled: { type: Boolean, default: false },
  subscribedTypes: {
    type: [String],
    enum: ['Gold', 'Gems', 'Materials'],
    default: [],
  },
  subscribedServers: {
    type: [String],
    default: [],
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserPrefs', userPrefsSchema);
