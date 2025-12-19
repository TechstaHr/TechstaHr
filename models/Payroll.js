const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

// Define deduction breakdown subdocument schema explicitly
const DeductionBreakdownSchema = new mongoose.Schema({
  deductionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deduction'
  },
  name: String,
  type: String,
  calculationType: String,
  value: Number,
  amount: Number,
  isPreTax: Boolean
}, { _id: false }); // Don't create _id for subdocuments

const PayrollSchema = new mongoose.Schema({
  payrollId: {
    type: Number,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Bank'
  },
  narration: { type: String, required: false },
  paymentAmount: {
    type: Number,
    required: true,
    comment: 'Net amount to be paid after deductions'
  },

  // Payroll calculation breakdown
  grossAmount: {
    type: Number,
    comment: 'Total amount before deductions (hours × rate)'
  },
  totalHours: {
    type: Number,
    comment: 'Total approved hours for this payroll period'
  },
  hourlyRate: {
    type: Number,
    comment: 'Hourly rate used for calculation (snapshot)'
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  deductions: [DeductionBreakdownSchema],
  totalDeductions: {
    type: Number,
    default: 0
  },

  // Pay period information
  payPeriodStart: {
    type: Date,
    comment: 'Start date of pay period'
  },
  payPeriodEnd: {
    type: Date,
    comment: 'End date of pay period'
  },

  // Time entries included in this payroll
  timeEntries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeEntry'
  }],

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

// Add auto-increment plugin for payrollId
PayrollSchema.plugin(AutoIncrement, {
  inc_field: 'payrollId',
  start_seq: 10000
});

module.exports = mongoose.model('Payroll', PayrollSchema);
