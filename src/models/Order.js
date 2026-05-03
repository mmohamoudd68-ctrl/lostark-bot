const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  quantity: { type: Number, required: true },
  ticketChannelId: { type: String },
  claimedAt: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true, uppercase: true },
  type: { type: String, enum: ['Gold', 'Gems', 'Materials'], required: true },
  server: { type: String, required: true },
  status: { type: String, enum: ['open', 'partial', 'completed', 'cancelled'], default: 'open' },

  // Gold fields
  goldQuantity: { type: Number },
  goldPrice: { type: Number }, // price per 1k gold in USD

  // Gems fields
  gemLevel: { type: Number },
  gemValueInGold: { type: Number },
  gemGoldPrice: { type: Number },
  gemQuantity: { type: Number },

  // Materials fields
  materialName: { type: String },
  materialValueInGold: { type: Number },
  materialQuantity: { type: Number },

  // Tracking
  totalQuantity: { type: Number, required: true },
  remainingQuantity: { type: Number, required: true },
  claims: [claimSchema],

  // Discord references
  messageId: { type: String },
  channelId: { type: String },
  createdBy: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

orderSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
