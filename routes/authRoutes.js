const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/create-admin', authenticateToken, authorizeAdmin, authCtrl.createAdmin);
router.post('/create-user', authenticateToken, authorizeAdmin, authCtrl.createUserByAdmin);
router.patch(`/update-role/:userId`, authenticateToken, authorizeAdmin, authCtrl.updateUserRole);
router.post('/invite-user', authenticateToken, authCtrl.inviteUser);
router.post('/resend-invite', authenticateToken, authCtrl.resendInvite);
router.post('/signup', authCtrl.signup);
router.post('/login', authCtrl.login);
router.post('/logout', authenticateToken, authCtrl.logout);
router.post('/send-otp', authCtrl.sendOtp);
router.post('/verify-otp', authCtrl.verifyOtp);
router.post('/set-password', authCtrl.setPassword);
router.put('/update-password', authenticateToken, authCtrl.updatePassword);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password', authCtrl.resetPassword);

module.exports = router;