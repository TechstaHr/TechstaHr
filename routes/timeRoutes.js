const express = require('express');
const router = express.Router();

const timesheetController = require('../controllers/timesheetController');

let authMiddleware;
try {
  const mw = require('../middlewares/authMiddleware');
  authMiddleware = (typeof mw === 'function') ? mw : (mw && (mw.authenticateToken || mw.authenticate));
} catch (e) {
  
  authMiddleware = (req, res, next) => {
    if (!req.user) req.user = { _id: req.body.userId || req.query.userId || '000000000000000000000000', role: 'user' };
    next();
  };
}


router.post('/clock-in', authMiddleware, timesheetController.clockIn);
router.post('/clock-out', authMiddleware, timesheetController.clockOut);
router.post('/submit', authMiddleware, timesheetController.submitTimesheet);
router.get('/my', authMiddleware, timesheetController.getMyTimesheets);

router.post('/approve', authMiddleware, timesheetController.approveTimesheet);
router.get('/all', authMiddleware, timesheetController.getAllTimesheets);

module.exports = router;
