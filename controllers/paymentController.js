const axios = require('axios');
const crypto = require('crypto');
const flutterwaveUtils = require('../utils/flutterwave');
const ledger = require('../utils/ledger');
const Payroll = require('../models/Payroll');
const Bank = require('../models/Bank');
const BillingInfo = require('../models/BillingInfo');
const User = require('../models/User');
const Charge = require('../models/Charge');
const { logWebhook } = require('../utils/webhook-logger');

const PAYSTACK_SECRET_KEY = process.env.PYS_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET;

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
    // Ensure wallet has sufficient funds before initiating transfer
    const wallet = await ledger.ensureWallet(existingPayroll.userId, existingBank.currency);
    if ((wallet.available_balance || 0) < existingPayroll.paymentAmount) {
      return res.status(400).json({ message: "Insufficient wallet balance for payout." });
    }

    const response = await flutterwaveUtils.directTransfer(data);

    // Debit wallet only after successful initiation
    try {
      await ledger.debitAvailable({
        userId: existingPayroll.userId,
        currency: existingBank.currency,
        amount: existingPayroll.paymentAmount,
        type: 'payout',
        reference: existingPayroll.trxReference,
        external_id: existingPayroll._id.toString(),
        metadata: { payrollId: existingPayroll._id }
      });
    } catch (walletErr) {
      console.error('Failed to debit wallet after transfer initiation:', walletErr);
      // Optionally, you might want to flag this payout for review/refund if debit fails
    }

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

    if (event.type === 'charge.completed') {
      if (!event.data) {
        console.error('Missing event.data in charge.completed webhook');
        return res.status(400).json({ message: 'Missing event data' });
      }

      const { id: chargeId, status, customer, amount, currency, reference } = event.data;
      
      console.log('Charge webhook received:', { chargeId, status, customer_id: customer?.id, amount, currency });

      if (status !== 'succeeded') {
        console.log('Charge not succeeded, status:', status);
        return res.status(200).json({ message: 'Charge not succeeded yet', status });
      }

      if (!customer?.id) {
        console.error('Missing customer.id in charge webhook');
        return res.status(400).json({ message: 'Missing customer ID' });
      }
      const user = await User.findOne({ flw_customer_id: customer.id }).select('_id email');
      
      if (!user) {
        console.error('No user found for flw_customer_id:', customer.id);
        return res.status(404).json({ message: 'User not found for customer ID' });
      }

      console.log('Found user:', user._id, user.email);

      const existingCharge = await Charge.findOne({ flw_charge_id: chargeId });
      
      if (existingCharge && existingCharge.status === 'succeeded') {
        console.log('Charge already processed:', chargeId);
        return res.status(200).json({ message: 'Charge already processed' });
      }

      try {
        await Charge.findOneAndUpdate(
          { flw_charge_id: chargeId },
          {
            $set: {
              user: user._id,
              customer_id: customer.id,
              flw_charge_id: chargeId,
              reference: reference || event.data.reference,
              amount,
              currency,
              status: 'succeeded',
              settled: event.data.settled,
              settlement_id: event.data.settlement_id,
              processor_response: event.data.processor_response,
              meta: event.data.meta,
              fees: event.data.fees,
              raw: event.data,
              payment_method_provider_id: event.data.payment_method?.id
            }
          },
          { upsert: true, new: true }
        );
      } catch (chargeErr) {
        console.error('Failed to update charge record:', chargeErr);
        // Continue to credit wallet even if charge update fails
      }

      // Credit user's wallet
      try {
        await ledger.creditAvailable({
          userId: user._id,
          currency,
          amount,
          type: 'charge',
          reference: reference || chargeId,
          external_id: chargeId,
          metadata: { 
            charge_id: chargeId,
            customer_id: customer.id,
            webhook_id: event.webhook_id,
            source: 'webhook'
          }
        });
        
        console.log(`✓ Wallet credited: ${amount} ${currency} for user ${user._id}`);
        return res.status(200).json({ 
          message: 'Charge processed and wallet credited', 
          chargeId,
          amount,
          currency,
          userId: user._id
        });
      } catch (walletErr) {
        console.error('Failed to credit wallet:', walletErr);
        return res.status(500).json({ 
          message: 'Charge recorded but wallet credit failed',
          error: walletErr.message 
        });
      }
    }

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
    triggerPayment,
    flutterwaveWebhook,
};
