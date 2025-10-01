const axios = require('axios');
const flutterwaveUtils = require('../utils/flutterwave');
const Payroll = require('../models/Payroll');
const Bank = require('../models/Bank');

const PAYSTACK_SECRET_KEY = process.env.PYS_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const initializePayment = async (req, res) => {
    const { email, amount, frontend_callback_url } = req.body;

    if(!email || !amount){
        return res.status(400).json({
            message: 'Email and amount are required'
        });
    }
    try {
        const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            email,
            amount: amount * 100,
            callback_url: frontend_callback_url + '/verify-payment',
            }, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            res.status(200).json({
                message: 'Transaction initialized',
                data: response.data.data,
            }
        );

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Payment initialization failed',
            error: error.response?.data || error.message,
        });
    }
};

const verifyPayment = async (req, res) => {
    const { reference } = req.params;

    try {
        const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        });

            res.status(200).json({
                message: 'Payment verified',
                data: response.data.data,
            }
        );

    } catch (error) {
        res.status(500).json({
            message: 'Payment verification failed',
            error: error.response?.data || error.message,
        });
    }
};

const triggerPayment = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const existingPayroll = Payroll.findById(payrollId);
    if (!existingPayroll) {
      return res.status(404).json({ message: "Payroll entry not found." });
    }
    const existingBank = Bank.findById(existingPayroll.bankId);
    if (!existingBank) {
      return res.status(404).json({ message: "Bank not found." });
    }
    const existingBillingInfo = BillingInfo.findOne({ userId: existingPayroll.userId });
    if (!existingBillingInfo) {
      return res.status(404).json({ message: "No billing info found for user." });
    }
    data = {
      currency: existingBank.currency,
      paymentAmount: existingPayroll.paymentAmount,
      bank: {
        code: existingBank.code,
      },
      bankDetail: existingBillingInfo.bankDetail,
      userId: existingPayroll.userId,
      traceId: existingPayroll.traceId,
      idempotencyKey: existingPayroll.idempotencyKey,
    };
    const response = await flutterwaveUtils.directTransfer(data);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({
      message: 'Payment trigger failed',
      error: err,
    });
  }
};

module.exports = {
    initializePayment,
    verifyPayment,
};
