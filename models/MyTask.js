const mongoose = require("mongoose");

const MyTaskSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: String,
    deadline: Date,
    priority_tag: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    task_link: String,
    status: {
        type: String,
        enum: ['to_do', 'in_progress', 'blocked', 'done', 'cancelled'],
        default: 'to_do'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    estimatedHours: { type: Number, default: 0 },

    enableScreenshot: { type: Boolean, default: false },
    screenshotIntervalMinutes: { type: Number, default: 0 },
    lastScreenshotUrl: { type: String, default: null },
    screenshotHistory: [{ type: String }]

}, { timestamps: true });

module.exports = mongoose.models.MyTask || mongoose.model("MyTask", MyTaskSchema);