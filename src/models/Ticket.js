const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderCode: { type: String, required: true },
  claimId: { type: mongoose.Schema.Types.ObjectId, required: true },

  channelId: { type: String, required: true },
  channelName: { type: String, required: true },

  claimedBy: { type: String, required: true },       // userId
  claimedByUsername: { type: String, required: true },
  claimedQuantity: { type: Number, required: true },

  status: { type: String, enum: ['open', 'completed', 'cancelled', 'paid'], default: 'open' },

  paymentReference: { type: String },
  completedBy: { type: String },
  completedAt: { type: Date },

  cancelledBy: { type: String },
  cancelledAt: { type: Date },

  paidAt: { type: Date },
  paidBy: { type: String },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Ticket', ticketSchema);
