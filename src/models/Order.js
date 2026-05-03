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
  goldQuantity: { type: Number },   // total gold (e.g. 1,000,000)
  goldPrice: { type: Number },      // price per 100k gold in EGP
  goldUnit: { type: String },       // 'ألف' or 'مليون'

  // Gems fields
  gemLevel: { type: Number },
  gemGoldPrice: { type: Number },   // price per gem in EGP
  gemQuantity: { type: Number },
  gemImageUrl: { type: String },

  // Materials fields
  materialName: { type: String },
  materialGoldAmount: { type: Number }, // gold amount used to buy material
  materialImageUrl: { type: String },

  // Claim limit per user
  maxClaimPerUser: { type: Number },

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
