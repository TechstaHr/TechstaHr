const express = require("express");
const router = express.Router();
const notificationCtrl = require("../controllers/notificationController");
const { authenticateToken } = require("../middlewares/authMiddleware");
router.get("/preference", authenticateToken, notificationCtrl.getNotificationPreferences);
router.put("/preference", authenticateToken, notificationCtrl.setNotificationPreferences);
router.get("/", authenticateToken, notificationCtrl.getUserNotifications);
router.post("/create", authenticateToken, notificationCtrl.createNotification);
router.put("/:id/read", authenticateToken, notificationCtrl.markAsRead);
router.put("/read-all", authenticateToken, notificationCtrl.markAllAsRead);

module.exports = router;
