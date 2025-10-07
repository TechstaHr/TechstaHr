const express = require('express');
const router = express.Router();

const timesheetController = require('../controllers/timesheetController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/clock-in', authenticateToken, timesheetController.clockIn);
router.post('/clock-out', authenticateToken, timesheetController.clockOut);
router.post('/submit', authenticateToken, timesheetController.submitTimesheet);
router.get('/my', authenticateToken, timesheetController.getMyTimesheets);
router.get('/active', authenticateToken, timesheetController.getActiveEntry);
router.get('/report', authenticateToken, authorizeAdmin, timesheetController.generateReport);
router.post('/attach-screenshots', authenticateToken, timesheetController.attachScreenshots);

router.post('/approve', authenticateToken, authorizeAdmin, timesheetController.approveTimesheet);
router.get('/all', authenticateToken, authorizeAdmin, timesheetController.getAllTimesheets);

module.exports = router;
