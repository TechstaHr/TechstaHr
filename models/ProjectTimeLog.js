const mongoose = require('mongoose');

const ProjectTimeLogSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  submitted: { type: Boolean, default: false },
  submittedAt: { type: Date },
  endTime: { type: Date },
  durationMinutes: { type: Number }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProjectTimeLog', ProjectTimeLogSchema);
