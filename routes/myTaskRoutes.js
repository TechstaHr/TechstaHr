const express = require('express');
const router = express.Router();

const myTaskCtrl = require('../controllers/myTaskController');
const workloadCtrl = require('../controllers/workloadController');

const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/create', authenticateToken, myTaskCtrl.createMyTask);
router.get('/all', authenticateToken, myTaskCtrl.getAllTasks);
router.get('/', authenticateToken, myTaskCtrl.getAllTasksByUser);

// workload management (admin)
router.get('/workload', authenticateToken, authorizeAdmin, workloadCtrl.getAllWorkloads);
router.post('/workload/assign', authenticateToken, authorizeAdmin, workloadCtrl.assignWorkload);
router.put('/workload/:id', authenticateToken, authorizeAdmin, workloadCtrl.updateWorkload);
router.delete('/workload/:id', authenticateToken, authorizeAdmin, workloadCtrl.deleteWorkload);

router.get('/workload/limit/:userId', authenticateToken, authorizeAdmin, workloadCtrl.getUserLimit);
router.put('/workload/limit/:userId', authenticateToken, authorizeAdmin, workloadCtrl.setUserLimit);

router.post('/timer/start/:taskId', authenticateToken, myTaskCtrl.startTaskTimer);
router.post('/timer/stop/:taskId', authenticateToken, myTaskCtrl.stopTaskTimer);

router.get('/daily-timesheet', authenticateToken, myTaskCtrl.getDailyTaskTimesheet);
router.post('/submit-timesheet', authenticateToken, myTaskCtrl.submitTaskTimesheet);
router.get('/timesheets', authenticateToken, myTaskCtrl.getSubmittedTaskTimesheets);

router.put('/:id', authenticateToken, myTaskCtrl.updateTask);
router.delete('/:id', authenticateToken, myTaskCtrl.deleteTask);
router.get('/:id', authenticateToken, myTaskCtrl.getTaskById);

module.exports = router;