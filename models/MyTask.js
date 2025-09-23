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
        enum: ['to_do', 'in_progress', 'done'],
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

    enableScreenshot: { type: Boolean, default: false },
    screenshotIntervalMinutes: { type: Number, default: 30, min: 1 },
    nextScreenshotAt: Date,
    lastScreenshotUrl: String,
    screenshotHistory: [String]

}, { timestamps: true });

module.exports = mongoose.model("MyTask", MyTaskSchema);