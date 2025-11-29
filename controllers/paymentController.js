const axios = require('axios');
const crypto = require('crypto');
const flutterwaveUtils = require('../utils/flutterwave');
const Payroll = require('../models/Payroll');
const Bank = require('../models/Bank');
const BillingInfo = require('../models/BillingInfo');
const { logWebhook } = require('../utils/webhook-logger');

const PAYSTACK_SECRET_KEY = process.env.PYS_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET;

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
    const existingPayroll = await Payroll.findById(payrollId);
    if (!existingPayroll) {
      return res.status(404).json({ message: "Payroll entry not found." });
    }

    if (existingPayroll.paymentGateway.toLowerCase().trim() !== "flutterwave") {
      return res.status(503).json({ message: "Couldn't process payment, only flutterwave is currently supported." });
    }
    if (existingPayroll.paymentDue > new Date()) {
      return res.status(403).json({ message: "Pyament not due for processing." });
    }

    const existingBank = await Bank.findById(existingPayroll.bankId);
    if (!existingBank) {
      return res.status(404).json({ message: "Bank not found." });
    }
    const existingBillingInfo = await BillingInfo.findOne({ userId: existingPayroll.userId });
    if (!existingBillingInfo) {
      return res.status(404).json({ message: "No billing info found for user." });
    }
    const data = {
      currency: existingBank.currency,
      paymentAmount: existingPayroll.paymentAmount,
      bank: {
        code: existingBank.code,
      },
      bankDetail: existingBillingInfo.bankDetail,
      userId: existingPayroll.userId,
      traceId: existingPayroll.traceId,
      idempotencyKey: existingPayroll.idempotencyKey,
      reference: existingPayroll.trxReference,
    };
    const response = await flutterwaveUtils.directTransfer(data);
    existingPayroll.paymentStatus = "initiated";
    await existingPayroll.save();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({
      message: 'Payment trigger failed',
      error: err,
    });
  }
};

const verifyFlutterwaveSignature = (payload, signature) => {
  if (!FLW_WEBHOOK_SECRET) {
    console.warn('FLW_WEBHOOK_SECRET not configured - skipping signature verification');
    return true;
  }
  
  if (signature === FLW_WEBHOOK_SECRET) {
    console.log('✓ Webhook signature verified (direct match)');
    return true;
  }
  
  const hash = crypto.createHmac('sha256', FLW_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  const isValid = hash === signature;
  if (isValid) {
    console.log('✓ Webhook signature verified (HMAC)');
  } else {
    console.error('✗ Webhook signature mismatch');
    console.error('Expected (direct):', FLW_WEBHOOK_SECRET);
    console.error('Expected (HMAC):', hash);
    console.error('Received:', signature);
  }
  
  return isValid;
};

const flutterwaveWebhook = async (req, res) => {
  try{
    // logWebhook('Webhook received', { headers: req.headers, body: req.body });

    const signature = req.headers['verif-hash'];
    if (signature && !verifyFlutterwaveSignature(req.body, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;
    if (!event || typeof event !== 'object') {
      console.error('Invalid webhook payload - not an object:', event);
      return res.status(400).json({ message: 'Invalid webhook payload' });
    }

    const eventType = event.type || event['event.type'];

    if (event.type === 'transfer.disburse') {
      if (!event.data) {
        console.error('Missing event.data in webhook payload');
        return res.status(400).json({ message: 'Missing event data' });
      }

      const eventStatus = event.data.status?.toLowerCase();
      const trxReference = event.data.reference;
      
      console.log('Event status:', eventStatus);
      console.log('Transaction reference:', trxReference);

      if (!eventStatus || !trxReference) {
        console.error('Missing status or reference in webhook data');
        return res.status(400).json({ message: 'Missing required webhook data' });
      }

      const existingPayroll = await Payroll.findOne({trxReference: trxReference});
      if (!existingPayroll) {
        console.error('No payroll found for reference:', trxReference);
        return res.status(404).json({ message: 'No payroll found.' });
      }
      
      console.log('Found payroll:', existingPayroll._id);

      if (eventStatus === "successful") {
        existingPayroll.paymentStatus = "completed";
        await existingPayroll.save();
        console.log('Payment marked as completed');
        return res.status(200).json({ message: 'completed' });
      } else if(eventStatus === "failed") {
        existingPayroll.paymentStatus = "failed";
        await existingPayroll.save();
        console.log('Payment marked as failed');
        return res.status(200).json({ message: 'failed' });
      }
      
      console.log('Unhandled event status:', eventStatus);
      return res.status(200).json({ message: 'Event status not processed', status: eventStatus });
    }
    if (eventType === 'CARD_TRANSACTION' || event.status === 'successful') {
      // TODO: Add wallet funding logic here if needed
      // For now, acknowledge receipt
      return res.status(200).json({ 
        message: 'Payment event acknowledged', 
        type: eventType,
        status: event.status 
      });
    }

    console.log('Unhandled event type:', eventType || event.type);
    return res.status(200).json({ 
      message: 'Event type not processed', 
      type: eventType || event.type,
      availableKeys: Object.keys(event)
    });
  } catch (err) {
    res.status(500).json({ message: 'Error handling webhook event', error: err.message });
  }
};


module.exports = {
    initializePayment,
    verifyPayment,
    triggerPayment,
    flutterwaveWebhook,
};
