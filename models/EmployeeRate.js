const mongoose = require('mongoose');

const EmployeeRateSchema = new mongoose.Schema({
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
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'NGN'
  },
  rateType: {
    type: String,
    enum: ['hourly', 'daily', 'fixed'],
    default: 'hourly'
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
    enum: ['active', 'inactive'],
    default: 'active'
  },
  notes: {
    type: String
  }
}, { timestamps: true });

// Compound index to ensure one active rate per employee-employer-project combination
EmployeeRateSchema.index({ userId: 1, employerId: 1, projectId: 1, status: 1 });

// Method to check if rate is currently effective
EmployeeRateSchema.methods.isEffective = function(date = new Date()) {
  if (this.status !== 'active') return false;
  if (this.effectiveFrom > date) return false;
  if (this.effectiveTo && this.effectiveTo < date) return false;
  return true;
};

module.exports = mongoose.model('EmployeeRate', EmployeeRateSchema);
