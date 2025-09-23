const BillingInfo = require('../models/BillingInfo');

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
    getBilling
}