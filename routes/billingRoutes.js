const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billingController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');
const Bank = require('../models/Bank');

router.post('/', authenticateToken, billingCtrl.createBilling);
router.put('/', authenticateToken, billingCtrl.updateBilling);
router.get('/', authenticateToken, billingCtrl.getBilling);
router.post('/banks/add', authenticateToken, authorizeAdmin, billingCtrl.addBank);
router.get('/banks/:id', authenticateToken, authorizeAdmin, billingCtrl.getBank);
router.patch('/banks/update/:id', authenticateToken, authorizeAdmin, billingCtrl.updateBank);
router.delete('/banks/delete/:id', authenticateToken, authorizeAdmin, billingCtrl.deleteBank);
router.get('/banks', async (req, res) => {
  try {
    const banks = await Bank.find().sort({ bankName: 1 });
    res.status(200).json({ message: 'Banks fetched successfully', banks });
  } catch (err) {
    console.error('Error fetching banks:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/payroll', authenticateToken, authorizeAdmin, billingCtrl.createPayroll);
router.get('/payroll/:id', authenticateToken, authorizeAdmin, billingCtrl.getPayroll);
router.get('/payrolls', authenticateToken, billingCtrl.getAllPayroll);
router.post('/payroll/update/:id', authenticateToken, authorizeAdmin, billingCtrl.updatePayroll);
router.post('/banks/add', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { bankName, code, country = 'Nigeria', currency = 'NGN' } = req.body;
    if (!bankName || !code) return res.status(400).json({ message: 'bankName and code required' });

    const bank = await Bank.create({ bankName, code: String(code).trim(), country, currency });
    res.status(201).json({ message: 'Bank added', bank });
  } catch (err) {
    console.error('Error adding bank:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// Payment Methods Management
router.post('/payment-methods', authenticateToken, billingCtrl.createPaymentMethod);
router.get('/payment-methods', authenticateToken, billingCtrl.getPaymentMethods);
router.patch('/payment-methods/:paymentMethodId/default', authenticateToken, billingCtrl.setDefaultPaymentMethod);
router.delete('/payment-methods/:paymentMethodId', authenticateToken, billingCtrl.deletePaymentMethod);
// Initiate a charge on a payment method
router.post('/initiate-charge', authenticateToken, billingCtrl.createCharge);

module.exports = router;
