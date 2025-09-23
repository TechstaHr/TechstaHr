const express = require('express');
const router = express.Router();
const screenshotCtrl = require('../controllers/screenshotController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.put('/:taskId/screenshot-settings', authenticateToken, screenshotCtrl.setScreenshotSettings);
router.put('/:taskId/stop-screenshot', authenticateToken, screenshotCtrl.stopScreenshot);
router.get('/:taskId/screenshots', authenticateToken, screenshotCtrl.getTaskScreenshots);

module.exports = router;