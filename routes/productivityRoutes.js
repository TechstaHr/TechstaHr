const express = require('express');
const router = express.Router();
const productivityCtrl = require('../controllers/productivityController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.get('/user/:id', authenticateToken, productivityCtrl.getUserWeeklyProductivity);
router.get('/all', authenticateToken, authorizeAdmin, productivityCtrl.getAllUsersProductivity);

module.exports = router;