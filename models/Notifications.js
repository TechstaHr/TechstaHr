const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ['email', 'comment', 'task_assigned', 'project_invitation', 'issue_created', 'project_status_updated', 'task_created', 'task_updated', 'task_deleted'],
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    link: String,
    isRead: {
        type: Boolean,
        default: false,
    },
    actions: [
        {
        label: String,
        url: String,
        },
    ],
}, { timestamps: true });

module.exports = mongoose.model("Notification", NotificationSchema);