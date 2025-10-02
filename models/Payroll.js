const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true
  },
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Bank',
    unique: true
  },
  narration: { type: String, required: false },
  paymentAmount: { type: Number, required: true },
  paymentDue: { type: Date, required: false },
  paymentStatus: {
    type: String,
    enum: ['initiated', 'completed', 'scheduled', 'failed'],
    required: true
  },
  paymentGateway: { type: String, required: true },
  traceId: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  trxReference: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Payroll', PayrollSchema);
