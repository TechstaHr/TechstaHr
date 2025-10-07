const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billingController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/', authenticateToken, billingCtrl.createBilling);
router.put('/', authenticateToken, billingCtrl.updateBilling);
router.get('/', authenticateToken, billingCtrl.getBilling);
router.post('/banks', authenticateToken, authorizeAdmin, billingCtrl.addBank);
router.get('/banks', billingCtrl.getBanks);
router.post('/payroll', authenticateToken, authorizeAdmin, billingCtrl.createPayroll);
router.post('/payroll/update/:id', authenticateToken, authorizeAdmin, billingCtrl.updatePayroll);

module.exports = router;
