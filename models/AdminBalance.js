const mongoose = require('mongoose');

const AdminBalanceSchema = new mongoose.Schema({
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Admin balance cannot go below 0'],
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  locked: {
    type: Boolean,
    default: false, // Used during payroll processing
  },
  lastTransactionId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true, // adds createdAt, updatedAt automatically
});

// Enforce singleton (only one AdminBalance doc exists)
AdminBalanceSchema.index({}, { unique: true });

module.exports = mongoose.model('AdminBalance', AdminBalanceSchema);
