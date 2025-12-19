const mongoose = require('mongoose');
const crypto = require('crypto');

const BillingInfo = require('../models/BillingInfo');
const Bank = require('../models/Bank');
const Payroll = require('../models/Payroll');
const PaymentMethod = require('../models/PaymentMethod');
const Charge = require('../models/Charge');
const User = require('../models/User');
const TimeEntry = require('../models/TimeEntry');
const EmployeeRate = require('../models/EmployeeRate');
const Deduction = require('../models/Deduction');
const Project = require('../models/Project');
const ledger = require('../utils/ledger');
const { addPaymentMethod, initiateCharge, updateCharge: updateFlwCharge } = require('../utils/flutterwave');

// Helper function to round currency amounts to 2 decimal places
const roundCurrency = (amount) => Math.round(amount * 100) / 100;

const addBank = async (req, res) => {
    try {
        const existing = await Bank.findOne({ bankName: req.body.bankName });
        if (existing) return res.status(409).json({ message: 'Bank already exist' });

        const newBank = new Bank({ ...req.body });
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
        const employerId = req.user.id;
        const {
            userId,
            bankId,
            payPeriodStart,
            payPeriodEnd,
            paymentDue,
            paymentGateway,
            narration
        } = req.body;

        // Validate required fields
        if (!userId || !bankId || !payPeriodStart || !payPeriodEnd) {
            return res.status(400).json({
                message: 'Missing required fields: userId, bankId, payPeriodStart, payPeriodEnd'
            });
        }

        // Verify employee exists
        const employee = await User.findById(userId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Verify bank exists
        const bank = await Bank.findById(bankId);
        if (!bank) {
            return res.status(404).json({ message: 'Bank not found' });
        }

        // 1. Fetch all approved time entries for the pay period
        const periodStart = new Date(payPeriodStart);
        const periodEnd = new Date(payPeriodEnd);
        periodEnd.setHours(23, 59, 59, 999);

        const timeEntries = await TimeEntry.find({
            user: userId,
            status: 'approved',
            date: { $gte: periodStart, $lte: periodEnd }
        });

        if (timeEntries.length === 0) {
            return res.status(400).json({
                message: 'No approved time entries found for this period',
                period: { start: payPeriodStart, end: payPeriodEnd }
            });
        }

        // 2. Calculate total hours
        const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);

        if (totalHours === 0) {
            return res.status(400).json({
                message: 'No billable hours found in approved time entries'
            });
        }

        // 3. Get active employee rate
        const activeRate = await EmployeeRate.findOne({
            userId,
            employerId,
            status: 'active',
            effectiveFrom: { $lte: periodEnd }
        }).sort({ effectiveFrom: -1 });

        if (!activeRate) {
            return res.status(404).json({
                message: 'No active rate found for this employee. Please set an hourly rate first.'
            });
        }

        // 4. Calculate gross amount (rounded to 2 decimals)
        const grossAmount = roundCurrency(totalHours * activeRate.hourlyRate);

        // 5. Get active deductions and sort by priority
        const activeDeductions = await Deduction.find({
            userId,
            employerId,
            status: 'active',
            effectiveFrom: { $lte: periodEnd },
            $or: [
                { effectiveTo: { $exists: false } },
                { effectiveTo: { $gte: periodStart } }
            ]
        }).sort({ priority: 1 });

        // 6. Apply deductions in order
        let runningAmount = grossAmount;
        const deductionBreakdown = [];
        let totalDeductions = 0;

        // Separate pre-tax and post-tax deductions
        const preTaxDeductions = activeDeductions.filter(d => d.isPreTax);
        const postTaxDeductions = activeDeductions.filter(d => !d.isPreTax);

        // Apply pre-tax deductions first
        for (const deduction of preTaxDeductions) {
            const deductionAmount = roundCurrency(deduction.calculateAmount(runningAmount));

            deductionBreakdown.push({
                deductionId: deduction._id,
                name: deduction.name,
                type: deduction.deductionType,
                calculationType: deduction.calculationType,
                value: deduction.value,
                amount: deductionAmount,
                isPreTax: true
            });

            runningAmount -= deductionAmount;
            totalDeductions += deductionAmount;

            // Update totalDeducted for non-recurring deductions
            if (!deduction.isRecurring) {
                deduction.totalDeducted += deductionAmount;

                // Mark as completed if target reached
                if (deduction.targetAmount && deduction.totalDeducted >= deduction.targetAmount) {
                    deduction.status = 'completed';
                    deduction.effectiveTo = new Date();
                }

                await deduction.save();
            }
        }

        // Apply post-tax deductions
        for (const deduction of postTaxDeductions) {
            const deductionAmount = roundCurrency(deduction.calculateAmount(runningAmount));

            deductionBreakdown.push({
                deductionId: deduction._id,
                name: deduction.name,
                type: deduction.deductionType,
                calculationType: deduction.calculationType,
                value: deduction.value,
                amount: deductionAmount,
                isPreTax: false
            });

            runningAmount -= deductionAmount;
            totalDeductions += deductionAmount;

            // Update totalDeducted for non-recurring deductions
            if (!deduction.isRecurring) {
                deduction.totalDeducted += deductionAmount;

                // Mark as completed if target reached
                if (deduction.targetAmount && deduction.totalDeducted >= deduction.targetAmount) {
                    deduction.status = 'completed';
                    deduction.effectiveTo = new Date();
                }

                await deduction.save();
            }
        }

        // 7. Calculate net amount (final payment amount) - round to 2 decimals
        const netAmount = roundCurrency(Math.max(0, runningAmount));
        const finalTotalDeductions = roundCurrency(totalDeductions);

        // 8. Create payroll record with full breakdown
        const newPayroll = new Payroll({
            userId,
            bankId,
            narration: narration || `Payroll for ${payPeriodStart} to ${payPeriodEnd}`,

            // Payment details
            paymentAmount: netAmount,
            paymentDue: paymentDue || new Date(),
            paymentStatus: 'scheduled',
            paymentGateway: paymentGateway || 'flutterwave',

            // Calculation breakdown
            grossAmount,
            totalHours,
            hourlyRate: activeRate.hourlyRate,
            currency: activeRate.currency || bank.currency || 'NGN',
            deductions: deductionBreakdown,
            totalDeductions: finalTotalDeductions,

            // Pay period
            payPeriodStart: periodStart,
            payPeriodEnd: periodEnd,

            // Reference time entries
            timeEntries: timeEntries.map(entry => entry._id),

            // Transaction identifiers
            traceId: new mongoose.Types.ObjectId(),
            idempotencyKey: new mongoose.Types.ObjectId(),
            trxReference: new mongoose.Types.ObjectId(),
        });

        await newPayroll.save();

        // Populate for response
        await newPayroll.populate([
            { path: 'userId', select: 'full_name email' },
            { path: 'bankId', select: 'bankName code currency' },
            { path: 'timeEntries', select: 'date totalHours status' }
        ]);

        res.status(201).json({
            message: 'Payroll created successfully',
            payroll: newPayroll,
            summary: {
                totalHours,
                hourlyRate: activeRate.hourlyRate,
                grossAmount,
                totalDeductions: finalTotalDeductions,
                netAmount,
                deductionsApplied: deductionBreakdown.length
            }
        });

    } catch (err) {
        console.error('Error creating payroll:', err);
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
        // Allow admin to create/update billing for other users
        let userId;
        userId = req.user.id;
        await BillingInfo.deleteOne({ userId });

        let existing = await BillingInfo.findOne({ userId });
        let billing;
        let isNewRecord = false;

        if (existing) {
            const { userId: _, ...updateData } = req.body;
            Object.assign(existing, updateData);
            billing = await existing.save();
            console.log('Updated existing billing info for user:', userId);
        } else {
            const { userId: _, ...billingData } = req.body;
            billing = new BillingInfo({ userId, ...billingData });
            await billing.save();
            isNewRecord = true;
            console.log('Created new billing info for user:', userId);
        }

        let paymentMethod = null;
        let paymentMethodError = null;

        if (billing.bankDetail && billing.bankDetail.accountName &&
            billing.bankDetail.accountNumber && billing.bankDetail.bankId) {

            try {
                const user = await User.findById(userId).select('flw_customer_id');

                if (!user) {
                    console.log('User not found, skipping payment method creation');
                    paymentMethodError = 'User not found';
                } else if (!user.flw_customer_id) {
                    console.log('User does not have flw_customer_id, skipping payment method creation');
                    paymentMethodError = 'No Flutterwave customer ID found. Please add address to your profile.';
                } else {
                    const bank = await Bank.findById(billing.bankDetail.bankId);

                    if (!bank) {
                        console.log('Bank not found with ID:', billing.bankDetail.bankId);
                        paymentMethodError = 'Bank not found';
                    } else if (!bank.code) {
                        console.log('Bank does not have code:', bank);
                        paymentMethodError = 'Bank code not available';
                    } else {
                        // Create payment method using the bank details
                        const bank_account = {
                            name: billing.bankDetail.accountName,
                            number: billing.bankDetail.accountNumber,
                            bank_code: bank.code
                        };

                        console.log('Auto-creating payment method from billing info:', {
                            name: bank_account.name,
                            number: '***' + bank_account.number.slice(-4),
                            bank_code: bank_account.bank_code
                        });

                        const result = await addPaymentMethod({
                            type: 'bank_account',
                            userId,
                            customer_id: user.flw_customer_id,
                            bank_account,
                            meta: {
                                source: 'billing_info',
                                created_at: new Date().toISOString()
                            },
                            traceId: crypto.randomBytes(16).toString('hex')
                        });

                        const existingPaymentMethods = await PaymentMethod.countDocuments({
                            user: userId,
                            is_active: true
                        });
                        const shouldBeDefault = existingPaymentMethods === 0;

                        // Save payment method to database
                        const paymentMethodData = {
                            user: userId,
                            provider: 'flutterwave',
                            provider_payment_method_id: result.data.id,
                            type: 'bank_account',
                            is_default: shouldBeDefault,
                            metadata: result.data
                        };

                        if (result.data.bank_account) {
                            paymentMethodData.bank = {
                                account_number_last4: result.data.bank_account.number?.slice(-4) || bank_account.number?.slice(-4),
                                bank_name: result.data.bank_account.bank_name || bank.bankName,
                                account_name: result.data.bank_account.name || bank_account.name,
                                bank_code: result.data.bank_account.bank_code || bank_account.bank_code
                            };
                        }

                        paymentMethod = await PaymentMethod.create(paymentMethodData);
                        console.log('Payment method created successfully:', paymentMethod._id);
                    }
                }
            } catch (paymentError) {
                console.error('Error auto-creating payment method:', paymentError);
                paymentMethodError = paymentError.message || 'Failed to create payment method';
            }
        }

        const response = {
            message: isNewRecord ? 'Billing info created successfully' : 'Billing info updated successfully',
            billing,
            payment_method: paymentMethod ? {
                id: paymentMethod._id,
                type: paymentMethod.type,
                is_default: paymentMethod.is_default,
                bank: paymentMethod.bank
            } : null
        };

        // Include warning if payment method wasn't created
        if (!paymentMethod && paymentMethodError) {
            response.warning = `Payment method not created: ${paymentMethodError}`;
        }

        res.status(isNewRecord ? 201 : 200).json(response);
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
        console.log(err)
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
        let { type, card, bank_account, meta, is_default } = req.body;

        // Check if user has flw_customer_id
        const user = await User.findById(userId).select('flw_customer_id');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.flw_customer_id) {
            return res.status(400).json({
                message: 'No Flutterwave customer ID found. Please complete your profile setup first.'
            });
        }

        // Auto-detect type if not provided based on what data is present
        if (!type) {
            if (bank_account || (!bank_account && !card)) {
                // Default to bank_account if bank_account is provided or neither is provided
                type = 'bank_account';
            } else if (card) {
                type = 'card';
            }
        }

        // Validate type
        if (!['card', 'bank_account'].includes(type)) {
            return res.status(400).json({
                message: 'Payment method type must be either "card" or "bank_account"'
            });
        }

        // Validate card details if type is card
        if (type === 'card' && !card) {
            return res.status(400).json({
                message: 'Card details are required for card payment method. Must include: nonce, encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, encrypted_cvv'
            });
        }

        // Handle bank account - use from request or fall back to billing info
        if (type === 'bank_account') {
            if (!bank_account) {
                // Try to get bank details from billing info
                const billingInfo = await BillingInfo.findOne({ userId })
                    .populate('bankDetail.bankId');

                if (!billingInfo || !billingInfo.bankDetail || !billingInfo.bankDetail.bankId) {
                    return res.status(400).json({
                        message: 'Bank account details are required. Either provide bank_account in request or ensure your billing info has bank details. Bank account must include: name, number, bank_code'
                    });
                }

                // Construct bank_account from billing info
                bank_account = {
                    name: billingInfo.bankDetail.accountName,
                    number: billingInfo.bankDetail.accountNumber,
                    bank_code: billingInfo.bankDetail.bankId.code
                };

                console.log('Using bank account from billing info:', {
                    name: bank_account.name,
                    number: '***' + bank_account.number.slice(-4),
                    bank_code: bank_account.bank_code
                });
            } else {
                // Validate provided bank_account
                if (!bank_account.name || !bank_account.number || !bank_account.bank_code) {
                    return res.status(400).json({
                        message: 'Bank account details must include: name, number, bank_code'
                    });
                }
            }
        }

        // Call Flutterwave to add payment method
        const result = await addPaymentMethod({
            type,
            userId,
            customer_id: user.flw_customer_id,
            card,
            bank_account,
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
            metadata: result.data
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

        if (type === 'bank_account' && result.data.bank_account) {
            paymentMethodData.bank = {
                account_number_last4: result.data.bank_account.number?.slice(-4) || bank_account.number?.slice(-4),
                bank_name: result.data.bank_account.bank_name,
                account_name: result.data.bank_account.name || bank_account.name,
                bank_code: result.data.bank_account.bank_code || bank_account.bank_code
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
        const { reference, currency, payment_method_id, redirect_url, amount, meta, authorization, recurring } = req.body;

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

        // Get payment method ID - either from request (can be Mongo _id or provider_payment_method_id) or use default
        let flwPaymentMethodId = payment_method_id;
        let paymentMethodDoc = null;

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

            if (defaultPaymentMethod.provider !== 'flutterwave') {
                return res.status(400).json({
                    message: 'Default payment method is not a Flutterwave payment method'
                });
            }

            flwPaymentMethodId = defaultPaymentMethod.provider_payment_method_id;
            paymentMethodDoc = defaultPaymentMethod;
        } else {
            // Lookup by Mongo _id when valid, otherwise by provider_payment_method_id (Flutterwave ID)
            const query = mongoose.isValidObjectId(payment_method_id)
                ? { _id: payment_method_id }
                : { provider_payment_method_id: payment_method_id };

            const paymentMethod = await PaymentMethod.findOne({
                user: userId,
                is_active: true,
                ...query
            });

            if (!paymentMethod) {
                return res.status(404).json({
                    message: 'Payment method not found or does not belong to you'
                });
            }

            if (paymentMethod.provider !== 'flutterwave') {
                return res.status(400).json({
                    message: 'This endpoint only supports Flutterwave payment methods'
                });
            }

            flwPaymentMethodId = paymentMethod.provider_payment_method_id;
            paymentMethodDoc = paymentMethod;

            // Update usage stats
            paymentMethod.last_used_at = new Date();
            paymentMethod.usage_count += 1;
            await paymentMethod.save();
        }

        // Call Flutterwave to initiate charge
        const orderId = req.body.order_id || `ord_${crypto.randomUUID()}`;

        const result = await initiateCharge({
            userId,
            reference,
            currency,
            payment_method_id: flwPaymentMethodId,
            redirect_url,
            amount,
            meta,
            authorization,
            recurring,
            order_id: orderId
        });

        // Persist the charge details locally
        try {
            await Charge.create({
                user: userId,
                payment_method: paymentMethodDoc?._id,
                payment_method_provider_id: flwPaymentMethodId,
                customer_id: result.data?.customer_id,
                flw_charge_id: result.data?.id,
                reference: result.data?.reference || reference,
                order_id: result.data?.order_id || orderId,
                amount: result.data?.amount,
                currency: result.data?.currency,
                status: result.data?.status,
                settled: result.data?.settled,
                settlement_id: result.data?.settlement_id,
                redirect_url: result.data?.next_action?.redirect_url?.url || result.data?.redirect_url,
                next_action: result.data?.next_action,
                processor_response: result.data?.processor_response,
                meta: result.data?.meta,
                fees: result.data?.fees,
                raw: result.data,
                created_datetime: result.data?.created_datetime ? new Date(result.data.created_datetime) : undefined,
            });
        } catch (persistErr) {
            console.error('Failed to persist charge:', persistErr);
        }

        // If the charge is already succeeded, credit wallet immediately
        if (result.data?.status === 'succeeded') {
            try {
                await ledger.creditAvailable({
                    userId,
                    currency,
                    amount,
                    type: 'charge',
                    reference: result.data?.reference || reference,
                    external_id: result.data?.id,
                    metadata: { charge_id: result.data?.id }
                });
            } catch (walletErr) {
                console.error('Failed to credit wallet for immediate success charge:', walletErr);
            }
        }

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


const updateCharge = async (req, res) => {
    try {
        const { chargeId } = req.params;
        const { type, meta } = req.body;

        let authorization = req.body.authorization;

        // Build authorization payload based on type if not explicitly provided
        if (!authorization && type) {
            if (type === 'otp') {
                const code = req.body.otp?.code || req.body.code;
                if (!code) {
                    return res.status(400).json({ message: 'OTP code is required for type otp' });
                }
                authorization = { type: 'otp', otp: { code } };
            } else if (type === 'pin') {
                const nonce = req.body.pin?.nonce || req.body.nonce;
                const encrypted_pin = req.body.pin?.encrypted_pin || req.body.encrypted_pin;
                if (!nonce || !encrypted_pin) {
                    return res.status(400).json({ message: 'Pin nonce and encrypted_pin are required for type pin' });
                }
                authorization = { type: 'pin', pin: { nonce, encrypted_pin } };
            } else if (type === 'external_3ds') {
                const transaction_status = req.body.external_3ds?.transaction_status || req.body.transaction_status;
                if (!transaction_status) {
                    return res.status(400).json({ message: 'transaction_status is required for type external_3ds' });
                }
                authorization = { type: 'external_3ds', external_3ds: { transaction_status } };
            } else {
                return res.status(400).json({ message: 'Unsupported authorization type' });
            }
        }

        if (!authorization) {
            return res.status(400).json({ message: 'Authorization data is required' });
        }

        const traceId = req.body.traceId || crypto.randomBytes(16).toString('hex');
        const chargeDoc = await Charge.findOne({ flw_charge_id: chargeId });
        const alreadySucceeded = chargeDoc?.status === 'succeeded';

        const result = await updateFlwCharge(chargeId, { authorization, meta, traceId });

        // Update local charge record if it exists
        try {
            const update = {
                status: result.data?.status,
                next_action: result.data?.next_action,
                processor_response: result.data?.processor_response,
                settled: result.data?.settled,
                settlement_id: result.data?.settlement_id,
                fees: result.data?.fees,
                meta: result.data?.meta,
                redirect_url: result.data?.next_action?.redirect_url?.url || result.data?.redirect_url,
                raw: result.data
            };

            await Charge.findOneAndUpdate(
                { flw_charge_id: chargeId },
                { $set: update },
                { new: true }
            );

            // If the charge just succeeded, credit wallet
            if (!alreadySucceeded && result.data?.status === 'succeeded' && chargeDoc) {
                try {
                    await ledger.creditAvailable({
                        userId: chargeDoc.user,
                        currency: chargeDoc.currency,
                        amount: chargeDoc.amount,
                        type: 'charge',
                        reference: chargeDoc.reference || chargeId,
                        external_id: chargeId,
                        metadata: { charge_id: chargeDoc._id }
                    });
                } catch (walletErr) {
                    console.error('Failed to credit wallet for charge:', walletErr);
                }
            }
        } catch (persistErr) {
            console.error('Failed to update local charge record:', persistErr);
        }

        res.status(200).json({
            message: 'Charge updated successfully',
            data: result.data,
            next_action: result.data?.next_action
        });
    } catch (error) {
        console.error('Error updating charge:', error);
        res.status(500).json({
            message: error.message || 'Failed to update charge',
            error
        });
    }
}


const setEmployeeRate = async (req, res) => {
    try {
        const employerId = req.user.id;
        const {
            userId,
            projectId,
            hourlyRate,
            currency,
            rateType,
            effectiveFrom,
            notes
        } = req.body;

        if (!userId || hourlyRate === undefined) {
            return res.status(400).json({ message: 'userId and hourlyRate are required' });
        }

        // Verify the employee exists
        const employee = await User.findById(userId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // If projectId is provided, verify it exists
        if (projectId) {
            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({ message: 'Project not found' });
            }
        }

        // Deactivate existing active rate for this specific combination
        await EmployeeRate.updateMany(
            {
                userId,
                employerId,
                projectId: projectId || null,
                status: 'active'
            },
            {
                $set: { status: 'inactive', effectiveTo: new Date() }
            }
        );

        const newRate = new EmployeeRate({
            userId,
            employerId,
            teamId: employee.team,
            projectId: projectId || null,
            hourlyRate,
            currency: currency || 'NGN',
            rateType: rateType || 'hourly',
            effectiveFrom: effectiveFrom || new Date(),
            notes,
            status: 'active'
        });

        await newRate.save();

        res.status(201).json({
            message: 'Employee rate set successfully',
            rate: newRate
        });
    } catch (err) {
        console.error('Error setting employee rate:', err);
        res.status(500).json({ message: err.message });
    }
};

const getEmployeeRate = async (req, res) => {
    try {
        const employerId = req.user.id;
        const { userId, projectId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'userId query parameter is required' });
        }

        const rate = await EmployeeRate.findOne({
            userId,
            employerId,
            projectId: projectId || null,
            status: 'active'
        }).sort({ effectiveFrom: -1 });

        if (!rate) {
            return res.status(404).json({ message: 'No active rate found for this employee' });
        }

        res.status(200).json(rate);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteEmployeeRate = async (req, res) => {
    try {
        const rateId = req.params.id;
        const rate = await EmployeeRate.findById(rateId);

        if (!rate) return res.status(404).json({ message: 'Rate not found' });

        // Ensure only the employer can delete/deactivate
        if (rate.employerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        rate.status = 'inactive';
        rate.effectiveTo = new Date();
        await rate.save();

        res.status(200).json({ message: 'Rate deactivated successfully' });
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
    getPayroll,
    getBank,
    deleteBank,
    updateBank,
    getAllPayroll,
    createPaymentMethod,
    getPaymentMethods,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    createCharge,
    updateCharge,
    setEmployeeRate,
    getEmployeeRate,
    deleteEmployeeRate,
}

