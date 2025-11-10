const express = require('express');
const router = express.Router();
const screenshotCtrl = require('../controllers/screenshotController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Changed from /:taskId/ to /:projectId/
router.put('/:projectId/screenshot-settings', authenticateToken, screenshotCtrl.setScreenshotSettings);
router.put('/:projectId/get-screenshot-settings', authenticateToken, screenshotCtrl.getScreenshotSettings);
router.put('/:projectId/stop-screenshot', authenticateToken, screenshotCtrl.stopScreenshot);
router.get('/:projectId/screenshots', authenticateToken, screenshotCtrl.getProjectScreenshots);
router.post('/:projectId/generate-upload-signature', authenticateToken, screenshotCtrl.generateUploadSignature);
router.post('/:projectId/notify-upload-completion', authenticateToken, screenshotCtrl.notifyUploadCompletion);

module.exports = router;
