const mongoose = require("mongoose");

const TaskTimeLogSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MyTask",
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  durationMinutes: {
    type: Number
  },
  submitted: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("TaskTimeLog", TaskTimeLogSchema);