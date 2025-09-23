const mongoose = require("mongoose");

const NotificationSettingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        unique: true,
        required: true
    },
    email_notification: {
        type: Boolean,
        default: true
    },
    comment_notification: {
        type: Boolean,
        default: true
    },
    task_assigned_notification: {
        type: Boolean,
        default: true
    },
    project_invitation_notification: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("NotificationSettings", NotificationSettingsSchema);