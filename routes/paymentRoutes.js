const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/paymentController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/initialize', paymentCtrl.initializePayment);
router.get('/verify/:reference', paymentCtrl.verifyPayment);
router.post('/trigger/:payrollId', authenticateToken, authorizeAdmin, paymentCtrl.triggerPayment);
router.post('/flutterwave-webhook', paymentCtrl.flutterwaveWebhook);

// Test endpoint - remove in production
router.post('/test-webhook', paymentCtrl.flutterwaveWebhook);

// Health check endpoint
router.get('/webhook-health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Webhook endpoint is reachable',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
