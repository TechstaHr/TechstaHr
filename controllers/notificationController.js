const Notifications = require("../models/Notifications");
const NotificationSettings = require("../models/NotificationSettings");

const setNotificationPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        const settings = await NotificationSettings.findOneAndUpdate(
            { user: userId },
            { $set: updates },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json(settings);
    } catch (error) {
        console.error("Error setting notification preferences:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getNotificationPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        let settings = await NotificationSettings.findOne({ user: userId });

        if (!settings) {
            settings = new NotificationSettings({ user: userId });
            await settings.save();
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error("Error fetching notification preferences:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const createNotification = async (req, res) => {
    try {
        const { recipientId, type, message, link } = req.body;

        if (!recipientId || !type || !message) {
            return res.status(400).json({ message: "Missing required parameters" });
        }

        const preferences = await NotificationSettings.findOne({ user: recipientId });

        if (!preferences || preferences[`${type}_notification`] === false) {
            return res.status(200).json({ message: "Notification not sent — preference disabled." });
        }

        const notification = new Notifications({
            recipient: recipientId,
            type,
            message,
            link
        });

        await notification.save();

        res.status(201).json({ message: "Notification created", notification });
    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        const notifications = await Notifications.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;

        if (!notificationId) {
            return res.status(400).json({ message: "Notification ID is required" });
        }

        const notification = await Notifications.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { $set: { isRead: true } },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.status(200).json(notification);
    } catch (error) {
        console.error("Error updating notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await Notifications.updateMany(
            { recipient: userId, isRead: false },
            { $set: { isRead: true } }
        );

        res.status(200).json({
            message: "All notifications marked as read",
            updatedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    setNotificationPreferences,
    getNotificationPreferences,
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead
};