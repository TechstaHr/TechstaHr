const express = require('express');
const router = express.Router();
const projectCtrl = require('../controllers/projectController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

router.post('/', authenticateToken, projectCtrl.createProject);

router.get('/project-stats', authenticateToken, projectCtrl.getProjectStats);
router.get('/my-projects', authenticateToken, projectCtrl.getMyProjects);
router.get('/', authenticateToken, projectCtrl.getAllProjects);

router.put('/progress/:id', authenticateToken, projectCtrl.updateProjectProgress);
router.put('/status/:id', authenticateToken, projectCtrl.updateProjectStatus);

router.get('/issues', authenticateToken, authorizeAdmin, projectCtrl.getAllIssues);
router.get('/my-issues', authenticateToken, projectCtrl.getMyIssues);

router.get('/progress/all', authenticateToken, projectCtrl.getAllProjectProgress);
router.get('/assigned/members/:projectId', authenticateToken, projectCtrl.getProjectMembers);

router.get('/assigned/team-members', authenticateToken, projectCtrl.getAllProjectMembersInTeam);

router.post('/timer/start/:projectId', authenticateToken, projectCtrl.startTimer);
router.post('/timer/stop/:projectId', authenticateToken, projectCtrl.stopTimer);

router.get('/daily-timesheet', authenticateToken, projectCtrl.getDailyTimesheet);
router.post('/submit-timesheet', authenticateToken, projectCtrl.submitTimesheet);
router.get('/timesheets', authenticateToken, projectCtrl.getSubmittedTimesheets);

router.post('/:projectId/assign-members', authenticateToken, projectCtrl.assignTeamMembers);
router.delete('/:projectId/remove-member', authenticateToken, projectCtrl.removeTeamMember);

router.get('/invitations', authenticateToken, projectCtrl.getProjectInvitations);
router.get('/team/pending-invitations', authenticateToken, projectCtrl.getPendingInvitations);

router.post('/accept-invite/:projectId', authenticateToken, projectCtrl.acceptProjectInvite);
router.post('/reject-invite/:projectId', authenticateToken, projectCtrl.rejectProjectInvite);

router.get('/daily-summary/:teamId/:date', authenticateToken, projectCtrl.getDailySummary);

router.post('/add-comment/:projectId', authenticateToken, projectCtrl.addProjectComment);
router.post('/reply/:projectId/:commentId', authenticateToken, projectCtrl.replyToProjectComment);
router.get('/comments/:projectId', authenticateToken, projectCtrl.getProjectComments);

router.post('/:id/issues', authenticateToken, projectCtrl.addProjectIssue);
router.put('/:projectId/issues/:issueId', authenticateToken, projectCtrl.updateProjectIssue);
router.delete('/:id', authenticateToken, projectCtrl.deleteProjectById);
router.get('/:id', authenticateToken, projectCtrl.getProjectById);

module.exports = router;