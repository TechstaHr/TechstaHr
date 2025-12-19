const express = require('express');
const router = express.Router();
const { authorizeAdmin } = require('../middlewares/authMiddleware');
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

router.post('/approve', authMiddleware, authorizeAdmin, timesheetController.approveTimesheet);
router.get('/all', authMiddleware, authorizeAdmin, timesheetController.getAllTimesheets);
router.get('/submitted/project/:projectId', authMiddleware, authorizeAdmin, timesheetController.getSubmittedTimesheetsByProject);

module.exports = router;

