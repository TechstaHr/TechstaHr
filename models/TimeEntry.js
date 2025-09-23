const mongoose = require('mongoose');

const TimeEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  totalHours: Number,
  regularHours: Number,
  overtimeHours: Number,
  status: { type: String, enum: ['pending', 'submitted', 'approved'], default: 'pending' }, 
  screenshots: [{ type: String }] 
}, {
  timestamps: true
});

TimeEntrySchema.index({ user: 1, project: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TimeEntry', TimeEntrySchema);
