const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billingController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/', authenticateToken, billingCtrl.createBilling);
router.put('/', authenticateToken, billingCtrl.updateBilling);
router.get('/', authenticateToken, billingCtrl.getBilling);

module.exports = router;