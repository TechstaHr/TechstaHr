const express = require('express');
const router = express.Router();

const userCtrl = require('../controllers/userController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.get('/users', authenticateToken, userCtrl.getAllUser);
router.get('/profile', authenticateToken, userCtrl.getUserProfile);
router.get('/zones', authenticateToken, userCtrl.listTimezones);


router.put('/profile', authenticateToken, upload.single('avatar'), userCtrl.updateUserProfile);
router.put('/update-region', authenticateToken, userCtrl.updateRegion);
router.put('/role/:id', authenticateToken, userCtrl.changeUserRole);

router.delete('/delete', authenticateToken, userCtrl.deleteMyAccount);
router.delete('/delete/:id', authenticateToken, authorizeAdmin, userCtrl.deleteUserAccount);

router.post('/clock-in/:projectId', authenticateToken, userCtrl.clockInOrManualEntry);
router.post('/clock-out/:projectId', authenticateToken, userCtrl.clockOut);
router.post('/admin-clock-out/:userId/:projectId', authenticateToken, authorizeAdmin, userCtrl.clockOut);

module.exports = router;