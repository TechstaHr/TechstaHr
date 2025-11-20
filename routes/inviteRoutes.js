const express = require('express');
const router = express.Router();
const { inviteUser } = require('../controllers/inviteController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/invite', authenticateToken, authorizeAdmin, inviteUser);

module.exports = router;
