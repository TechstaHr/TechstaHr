const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/paymentController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/trigger/:payrollId', authenticateToken, authorizeAdmin, paymentCtrl.triggerPayment);
router.post('/flutterwave-webhook', paymentCtrl.flutterwaveWebhook);

module.exports = router;
