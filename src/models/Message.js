const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
    default: 'success'
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  billingPeriod: {
    type: String, // formato: "YYYY-MM" (ej: "2026-01")
    required: true,
    index: true
  },
  messageId: {
    type: String, // ID del mensaje de WhatsApp
    required: false
  },
  errorMessage: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Índice compuesto para consultas de facturación
messageSchema.index({ billingPeriod: 1, status: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
