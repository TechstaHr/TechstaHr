const mongoose = require('mongoose');

const BankSchema = new mongoose.Schema({
  bankName: { type: String, required: true },
  code: { type: String, required: true },
  country: { type: String, required: true },
  currency: { type: String, required: true }
}, {timestamps: true});

module.exports = mongoose.model('Bank', BankSchema);
