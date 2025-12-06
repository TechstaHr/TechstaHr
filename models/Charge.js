const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema(
  {
    type: String,
    amount: Number,
  },
  { _id: false }
);

const ChargeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payment_method: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
    payment_method_provider_id: String,
    customer_id: String,
    flw_charge_id: { type: String },
    reference: String,
    order_id: String,
    amount: Number,
    currency: String,
    status: String,
    settled: Boolean,
    settlement_id: [String],
    redirect_url: String,
    next_action: mongoose.Schema.Types.Mixed,
    processor_response: mongoose.Schema.Types.Mixed,
    meta: mongoose.Schema.Types.Mixed,
    fees: [FeeSchema],
    raw: mongoose.Schema.Types.Mixed,
    created_datetime: Date,
  },
  {
    timestamps: true,
  }
);

ChargeSchema.index({ user: 1, flw_charge_id: 1 });
ChargeSchema.index({ reference: 1 });
// Unique index on flw_charge_id to prevent duplicate charge processing
ChargeSchema.index({ flw_charge_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Charge', ChargeSchema);
