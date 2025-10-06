const mongoose = require('mongoose');

const BillingInfo = require('../models/BillingInfo');
const Bank = require('../models/Bank');
const Payroll = require('../models/Payroll');

const addBank = async (req, res) => {
  try {
    const existing = await Bank.findOne({ bankName: req.body.bankName });
    if (existing) return res.status(409).json({ message: 'Bank already exist' });

    const newBank = new Bank({...req.body});
    console.log('New Bank Created:', newBank);
    await newBank.save();
    res.status(201).json({
      message: "Bank created successfully",
      bank: newBank,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBank = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.status(200).json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateBank = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Bank not found' });

    Object.assign(bank, req.body);
    await bank.save();
    res.status(200).json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteBank = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Bank not found' });

    await bank.remove();
    res.status(200).json({ message: 'Bank deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

const getBanks = async (req, res) => {
  try {
    banks = await Bank.find();
    res.status(200).json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createPayroll = async (req, res) => {
  try {
    const newPayroll = new Payroll({
      traceId: new mongoose.Types.ObjectId(),
      idempotencyKey: new mongoose.Types.ObjectId(),
      trxReference: new mongoose.Types.ObjectId(),
      ...req.body
    });
    await newPayroll.save();
    res.status(200).json(newPayroll);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePayroll = async (req, res) => {
  try {
    const existingPayroll = await Payroll.findById(req.params.id);
    if (existingPayroll.paymentStatus === "scheduled" || existingPayroll.paymentStatus === "failed") {
      res.status(403).json({ message: "Can only update scheduled payment" });
    }
    delete req.body.traceId;
    delete req.body.idempotencyKey;
    delete req.body.trxReference;
    Object.assign(existingPayroll, req.body);
    await existingPayroll.save();

    res.status(200).json(existingPayroll);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createBilling = async (req, res) => {
    try {
        const existing = await BillingInfo.findOne({ userId: req.user.id });
        if (existing) return res.status(400).json({ message: 'Billing info already exists' });

        const billing = new BillingInfo({ userId: req.user.id, ...req.body });
        await billing.save();
        res.status(201).json(billing);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateBilling = async (req, res) => {
    try {
        const updated = await BillingInfo.findOneAndUpdate(
            { userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!updated) return res.status(404).json({ message: 'Billing info not found' });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getBilling = async (req, res) => {
    try {
        const billing = await BillingInfo.findOne({ userId: req.user.id });

        if (!billing) {
            return res.status(404).json({ message: 'Billing info not found' });
        }

        res.json(billing);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createBilling,
    updateBilling,
    getBilling,
    addBank,
    getBanks,
    createPayroll,
    updatePayroll,
    getBank,
    deleteBank,
    updateBank
}
