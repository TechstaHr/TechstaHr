const mongoose = require('mongoose');

const LedgerEntrySchema = new mongoose.Schema(
  {
    entry_set: { type: String, index: true }, // groups the two sides of a double entry
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true },
    account: { type: String, required: true }, // e.g., user_available, user_pending, processor_clearing
    type: { type: String }, // e.g., charge, payout, adjustment
    reference: { type: String },
    external_id: { type: String }, // flutterwave charge id, payout id, etc.
    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    balance_available_after: { type: Number },
    balance_pending_after: { type: Number },
  },
  { timestamps: true }
);

LedgerEntrySchema.index({ user: 1, currency: 1, createdAt: -1 });
LedgerEntrySchema.index({ account: 1, currency: 1 });
LedgerEntrySchema.index({ reference: 1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
