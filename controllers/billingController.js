const mongoose = require('mongoose');
const crypto = require('crypto');

const BillingInfo = require('../models/BillingInfo');
const Bank = require('../models/Bank');
const Payroll = require('../models/Payroll');
const PaymentMethod = require('../models/PaymentMethod');
const { addPaymentMethod, initiateCharge } = require('../utils/flutterwave');

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
    if (existingPayroll.paymentStatus === "completed" || existingPayroll.paymentStatus === "failed") {
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

const getPayroll = async (req, res) => {
  try {
    const existingPayroll = await Payroll.findById(req.params.id);
    if (!existingPayroll) return res.status(404).json({ message: 'Payroll not found' });

    res.status(200).json(existingPayroll);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllPayroll = async (req, res) => {
  try {
    const existingPayroll = await Payroll.find();
    if (!existingPayroll) return res.status(404).json({ message: 'Payroll not found' });

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

const createPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, card, bank, meta, is_default } = req.body;

        // Validate type
        if (!type || (type !== 'card' && type !== 'bank')) {
            return res.status(400).json({ 
                message: 'Payment method type is required and must be either "card" or "bank"' 
            });
        }

        // Validate card details if type is card
        if (type === 'card' && !card) {
            return res.status(400).json({ 
                message: 'Card details are required for card payment method' 
            });
        }

        // Validate bank details if type is bank
        if (type === 'bank' && !bank) {
            return res.status(400).json({ 
                message: 'Bank details are required for bank payment method' 
            });
        }

        // Call Flutterwave to add payment method
        const result = await addPaymentMethod({
            type,
            userId,
            card,
            bank,
            meta,
            traceId: crypto.randomBytes(16).toString('hex')
        });

        // Check if this is the user's first payment method to set as default
        const existingPaymentMethods = await PaymentMethod.countDocuments({ 
            user: userId, 
            is_active: true 
        });
        const shouldBeDefault = is_default || existingPaymentMethods === 0;

        // Save payment method to database
        const paymentMethodData = {
            user: userId,
            provider: 'flutterwave',
            provider_payment_method_id: result.data.id,
            type,
            is_default: shouldBeDefault,
            flw_metadata: result.data
        };

        // Extract card/bank details for easy access
        if (type === 'card' && result.data.card) {
            paymentMethodData.card = {
                last4: result.data.card.last4 || card.encrypted_card_number?.slice(-4),
                brand: result.data.card.brand || result.data.card.type,
                expiry_month: result.data.card.expiry_month,
                expiry_year: result.data.card.expiry_year,
                card_holder_name: card.card_holder_name
            };
        }

        if (type === 'bank' && result.data.bank) {
            paymentMethodData.bank = {
                account_number_last4: result.data.bank.account_number?.slice(-4),
                bank_name: result.data.bank.bank_name,
                account_name: result.data.bank.account_name
            };
        }

        const savedPaymentMethod = await PaymentMethod.create(paymentMethodData);

        res.status(201).json({
            message: 'Payment method added successfully',
            data: {
                id: savedPaymentMethod._id,
                provider: savedPaymentMethod.provider,
                provider_method_id: savedPaymentMethod.getProviderMethodId(),
                type: savedPaymentMethod.type,
                card: savedPaymentMethod.card,
                bank: savedPaymentMethod.bank,
                is_default: savedPaymentMethod.is_default,
                created_at: savedPaymentMethod.createdAt
            }
        });

    } catch (error) {
        console.error('Error adding payment method:', error);
        
        // Handle specific error messages from Flutterwave utility
        if (error.message && error.message.includes('does not have a Flutterwave customer ID')) {
            return res.status(400).json({ 
                message: 'Please update your profile first to enable payment methods' 
            });
        }

        res.status(500).json({ 
            message: error.message || 'Failed to add payment method',
            error: error
        });
    }
};

const getPaymentMethods = async (req, res) => {
    try {
        const userId = req.user.id;

        const paymentMethods = await PaymentMethod.find({ 
            user: userId, 
            is_active: true 
        }).sort({ is_default: -1, createdAt: -1 });

        res.status(200).json({
            message: 'Payment methods retrieved successfully',
            data: paymentMethods
        });

    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ 
            message: 'Failed to fetch payment methods',
            error: error.message
        });
    }
};

const setDefaultPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethodId } = req.params;

        // Find the payment method
        const paymentMethod = await PaymentMethod.findOne({ 
            _id: paymentMethodId, 
            user: userId, 
            is_active: true 
        });

        if (!paymentMethod) {
            return res.status(404).json({ message: 'Payment method not found' });
        }

        // Set as default (pre-save hook will unset others)
        paymentMethod.is_default = true;
        await paymentMethod.save();

        res.status(200).json({
            message: 'Default payment method updated successfully',
            data: paymentMethod
        });

    } catch (error) {
        console.error('Error setting default payment method:', error);
        res.status(500).json({ 
            message: 'Failed to update default payment method',
            error: error.message
        });
    }
};

const deletePaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethodId } = req.params;

        // Find the payment method
        const paymentMethod = await PaymentMethod.findOne({ 
            _id: paymentMethodId, 
            user: userId 
        });

        if (!paymentMethod) {
            return res.status(404).json({ message: 'Payment method not found' });
        }

        // Soft delete by setting is_active to false
        paymentMethod.is_active = false;
        await paymentMethod.save();

        // If this was the default, set another one as default
        if (paymentMethod.is_default) {
            const anotherMethod = await PaymentMethod.findOne({ 
                user: userId, 
                is_active: true,
                _id: { $ne: paymentMethodId }
            });
            
            if (anotherMethod) {
                anotherMethod.is_default = true;
                await anotherMethod.save();
            }
        }

        res.status(200).json({
            message: 'Payment method deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting payment method:', error);
        res.status(500).json({ 
            message: 'Failed to delete payment method',
            error: error.message
        });
    }
};

const createCharge = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reference, currency, payment_method_id, redirect_url, amount, meta } = req.body;

        // Validate required fields
        if (!reference) {
            return res.status(400).json({ message: 'Reference is required' });
        }
        if (!currency) {
            return res.status(400).json({ message: 'Currency is required' });
        }
        if (!redirect_url) {
            return res.status(400).json({ message: 'Redirect URL is required' });
        }
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Valid amount is required' });
        }

        // Get payment method ID - either from request or use default
        let flwPaymentMethodId = payment_method_id;
        
        if (!flwPaymentMethodId) {
            // Try to use default payment method
            const defaultPaymentMethod = await PaymentMethod.findOne({ 
                user: userId, 
                is_default: true, 
                is_active: true 
            });
            
            if (!defaultPaymentMethod) {
                return res.status(400).json({ 
                    message: 'No payment method specified and no default payment method found' 
                });
            }
            
            // Ensure it's a Flutterwave payment method
            if (defaultPaymentMethod.provider !== 'flutterwave') {
                return res.status(400).json({ 
                    message: 'Default payment method is not a Flutterwave payment method' 
                });
            }
            
            flwPaymentMethodId = defaultPaymentMethod.provider_payment_method_id;
        } else {
            // Verify the payment method belongs to the user
            const paymentMethod = await PaymentMethod.findOne({ 
                user: userId, 
                _id: payment_method_id, 
                is_active: true 
            });
            
            if (!paymentMethod) {
                return res.status(404).json({ 
                    message: 'Payment method not found or does not belong to you' 
                });
            }
            
            // Ensure it's a Flutterwave payment method
            if (paymentMethod.provider !== 'flutterwave') {
                return res.status(400).json({ 
                    message: 'This endpoint only supports Flutterwave payment methods' 
                });
            }
            
            flwPaymentMethodId = paymentMethod.provider_payment_method_id;
            
            // Update usage stats
            paymentMethod.last_used_at = new Date();
            paymentMethod.usage_count += 1;
            await paymentMethod.save();
        }

        // Call Flutterwave to initiate charge
        const result = await initiateCharge({
            userId,
            reference,
            currency,
            payment_method_id: flwPaymentMethodId,
            redirect_url,
            amount,
            meta
        });

        res.status(201).json({
            message: 'Charge initiated successfully',
            data: result.data,
            next_action: result.data?.next_action
        });

    } catch (error) {
        console.error('Error initiating charge:', error);
        
        // Handle specific error messages
        if (error.message && error.message.includes('does not have a Flutterwave customer ID')) {
            return res.status(400).json({ 
                message: 'Please update your profile first to enable payments' 
            });
        }

        res.status(500).json({ 
            message: error.message || 'Failed to initiate charge',
            error: error
        });
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
    getPayroll,
    getBank,
    deleteBank,
    updateBank,
    getAllPayroll,
    createPaymentMethod,
    getPaymentMethods,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    createCharge
}
