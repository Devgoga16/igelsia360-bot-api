const mongoose = require('mongoose');

const billingPeriodSchema = new mongoose.Schema({
  period: {
    type: String, // formato: "YYYY-MM" (ej: "2026-01")
    required: true,
    unique: true,
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalMessages: {
    type: Number,
    default: 0
  },
  planLimit: {
    type: Number,
    default: 500
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'overdue', 'paid'],
    default: 'active'
  },
  // Periodo abierto para pago: día 1 al 5 del siguiente mes
  paymentDueDate: {
    type: Date,
    required: true
  },
  closedAt: {
    type: Date,
    required: false
  },
  amountDue: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Método para calcular el monto a cobrar (mensajes que exceden el plan)
billingPeriodSchema.methods.calculateAmount = function() {
  if (this.totalMessages > this.planLimit) {
    const extraMessages = this.totalMessages - this.planLimit;
    // Aquí puedes definir el precio por mensaje extra
    const pricePerExtraMessage = 0.05; // ejemplo: $0.05 por mensaje
    this.amountDue = extraMessages * pricePerExtraMessage;
  } else {
    this.amountDue = 0;
  }
  return this.amountDue;
};

// Método para marcar como pagado
billingPeriodSchema.methods.markAsPaid = function() {
  this.isPaid = true;
  this.status = 'paid';
  this.paidAt = new Date();
  return this.save();
};

const BillingPeriod = mongoose.model('BillingPeriod', billingPeriodSchema);

module.exports = BillingPeriod;
