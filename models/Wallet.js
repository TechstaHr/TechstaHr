const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true },
    available_balance: { type: Number, default: 0 },
    pending_balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WalletSchema.index({ user: 1, currency: 1 }, { unique: true });

module.exports = mongoose.model('Wallet', WalletSchema);
