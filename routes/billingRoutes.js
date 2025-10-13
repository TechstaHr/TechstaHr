const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billingController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/', authenticateToken, billingCtrl.createBilling);
router.put('/', authenticateToken, billingCtrl.updateBilling);
router.get('/', authenticateToken, billingCtrl.getBilling);
router.post('/banks/add', authenticateToken, authorizeAdmin, billingCtrl.addBank);
router.get('/banks/:id', authenticateToken, authorizeAdmin, billingCtrl.getBank);
router.patch('/banks/update/:id', authenticateToken, authorizeAdmin, billingCtrl.updateBank);
router.delete('/banks/delete/:id', authenticateToken, authorizeAdmin, billingCtrl.deleteBank);
router.get('/banks', billingCtrl.getBanks);
router.post('/payroll', authenticateToken, authorizeAdmin, billingCtrl.createPayroll);
router.get('/payroll/:id', authenticateToken, authorizeAdmin, billingCtrl.getPayroll);
router.post('/payroll/update/:id', authenticateToken, authorizeAdmin, billingCtrl.updatePayroll);

module.exports = router;
