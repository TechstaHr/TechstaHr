const crypto = require('crypto');
const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');

const ensureWallet = async (userId, currency) => {
  return Wallet.findOneAndUpdate(
    { user: userId, currency },
    { $setOnInsert: { available_balance: 0, pending_balance: 0 } },
    { new: true, upsert: true }
  );
};

const postEntries = async (entries) => {
  if (!entries.length) return;
  await LedgerEntry.insertMany(entries);
};

const creditAvailable = async ({
  userId,
  currency,
  amount,
  type,
  reference,
  external_id,
  description,
  metadata
}) => {
  const wallet = await ensureWallet(userId, currency);
  const entrySet = crypto.randomUUID();
  const newAvailable = (wallet.available_balance || 0) + amount;

  const base = { entry_set: entrySet, currency, type, reference, external_id, description, metadata };

  await postEntries([
    {
      ...base,
      user: userId,
      wallet: wallet._id,
      amount,
      direction: 'credit',
      account: 'user_available',
      balance_available_after: newAvailable
    },
    {
      ...base,
      amount,
      direction: 'debit',
      account: 'processor_clearing'
    }
  ]);

  wallet.available_balance = newAvailable;
  await wallet.save();
  return wallet;
};

const debitAvailable = async ({
  userId,
  currency,
  amount,
  type,
  reference,
  external_id,
  description,
  metadata
}) => {
  const wallet = await ensureWallet(userId, currency);
  const current = wallet.available_balance || 0;
  if (current < amount) {
    const err = new Error('Insufficient available balance');
    err.code = 'INSUFFICIENT_FUNDS';
    throw err;
  }

  const entrySet = crypto.randomUUID();
  const newAvailable = current - amount;

  const base = { entry_set: entrySet, currency, type, reference, external_id, description, metadata };

  await postEntries([
    {
      ...base,
      user: userId,
      wallet: wallet._id,
      amount,
      direction: 'debit',
      account: 'user_available',
      balance_available_after: newAvailable
    },
    {
      ...base,
      amount,
      direction: 'credit',
      account: 'processor_disbursement'
    }
  ]);

  wallet.available_balance = newAvailable;
  await wallet.save();
  return wallet;
};

module.exports = {
  ensureWallet,
  creditAvailable,
  debitAvailable
};
