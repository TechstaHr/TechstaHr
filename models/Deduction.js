const mongoose = require('mongoose');

const DeductionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    required: true
  },
  deductionType: {
    type: String,
    enum: ['tax', 'health_insurance', 'pension', 'loan_repayment', 'advance_deduction', 'custom'],
    required: true
  },
  calculationType: {
    type: String,
    enum: ['percentage', 'fixed_amount'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  priority: {
    type: Number,
    default: 0,
    comment: 'Lower numbers are applied first'
  },
  isPreTax: {
    type: Boolean,
    default: false,
    comment: 'If true, deduction is calculated before tax deductions'
  },
  maxAmount: {
    type: Number,
    min: 0,
    comment: 'Maximum amount that can be deducted per pay period'
  },
  isRecurring: {
    type: Boolean,
    default: true
  },
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed'],
    default: 'active'
  },
  description: {
    type: String
  },
  totalDeducted: {
    type: Number,
    default: 0,
    comment: 'Running total of amount deducted (for tracking loan repayments, etc.)'
  },
  targetAmount: {
    type: Number,
    min: 0,
    comment: 'Target amount for non-recurring deductions (e.g., loan principal)'
  }
}, { timestamps: true });

// Index for quick lookups of active deductions
DeductionSchema.index({ userId: 1, employerId: 1, status: 1, priority: 1 });

// Method to check if deduction is currently effective
DeductionSchema.methods.isEffective = function(date = new Date()) {
  if (this.status !== 'active') return false;
  if (this.effectiveFrom > date) return false;
  if (this.effectiveTo && this.effectiveTo < date) return false;
  
  // Check if non-recurring deduction has reached its target
  if (!this.isRecurring && this.targetAmount && this.totalDeducted >= this.targetAmount) {
    return false;
  }
  
  return true;
};

// Method to calculate deduction amount
DeductionSchema.methods.calculateAmount = function(baseAmount) {
  let amount = 0;
  
  if (this.calculationType === 'percentage') {
    amount = (baseAmount * this.value) / 100;
  } else {
    amount = this.value;
  }
  
  // Apply max amount cap if specified
  if (this.maxAmount && amount > this.maxAmount) {
    amount = this.maxAmount;
  }
  
  // For non-recurring deductions, check remaining amount
  if (!this.isRecurring && this.targetAmount) {
    const remaining = this.targetAmount - this.totalDeducted;
    if (amount > remaining) {
      amount = remaining;
    }
  }
  
  return Math.max(0, amount);
};

module.exports = mongoose.model('Deduction', DeductionSchema);
