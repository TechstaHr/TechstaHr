const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/paymentController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');
const AdminBalance = require('../models/AdminBalance');
const User = require('../models/User');
const axios = require('axios');

router.post('/initialize', paymentCtrl.initializePayment);
router.get('/verify/:reference', paymentCtrl.verifyPayment);
router.post('/trigger/:payrollId', authenticateToken, authorizeAdmin, paymentCtrl.triggerPayment);
router.post('/flutterwave-webhook', paymentCtrl.flutterwaveWebhook);

// Get admin balance
router.get('/admin/balance', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const adminBalance = await AdminBalance.findOne();
    if (!adminBalance) {
      return res.status(404).json({ message: 'Admin balance not found' });
    }
    res.status(200).json({ balance: adminBalance.balance });
  } catch (error) {
    console.error('Error fetching admin balance:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update admin balance
router.put('/admin/balance', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number') {
      return res.status(400).json({ message: 'Amount must be a number' });
    }

    let adminBalance = await AdminBalance.findOne();
    if (!adminBalance) {
      adminBalance = new AdminBalance({ balance: 0 });
    }

    adminBalance.balance += amount;
    await adminBalance.save();

    res.status(200).json({ message: 'Admin balance updated', balance: adminBalance.balance });
  } catch (error) {
    console.error('Error updating admin balance:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify Paystack payment, update user balance and admin balance
router.post('/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paymentData = response.data.data;

    if (paymentData.status !== 'success') {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const amount = paymentData.amount / 100; // Convert kobo → naira

    // Update user balance
    user.balance = (user.balance || 0) + amount;
    await user.save();

    // Update admin balance
    let adminBalance = await AdminBalance.findOne();
    if (!adminBalance) {
      adminBalance = new AdminBalance({ balance: 0 });
    }

    adminBalance.balance += amount;
    await adminBalance.save();

    res.status(200).json({
      message: 'Payment verified. User & Admin balance updated.',
      userBalance: user.balance,
      adminBalance: adminBalance.balance,
    });

  } catch (error) {
    console.error('Error verifying payment:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;
