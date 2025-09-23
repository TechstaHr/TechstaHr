const express = require('express');
const router = express.Router();
const { initializePayment, verifyPayment } = require('../controllers/paymentController');

router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);

module.exports = router;