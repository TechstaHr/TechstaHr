const mongoose = require('mongoose');

const TimeEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  date: { type: Date, required: true },
  // day is a normalized UTC-midnight date used for unique constraint per-day
  day: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  totalHours: Number,
  regularHours: Number,
  overtimeHours: Number,
  status: { type: String, enum: ['pending', 'submitted', 'approved'], default: 'pending' }, 
  screenshots: [{ url: String, takenAt: { type: Date, default: Date.now } }]
}, {
  timestamps: true
});

// normalize day field before validation to the UTC midnight of the `date` or `startTime`
TimeEntrySchema.pre('validate', function (next) {
  try {
    const src = this.date || this.startTime || new Date();
    const d = new Date(src);
    // create a UTC midnight date for the day
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    this.day = day;
  } catch (err) {
    // fallback to today at UTC midnight
    const now = new Date();
    this.day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  next();
});

// enforce uniqueness per user/project/day
TimeEntrySchema.index({ user: 1, project: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('TimeEntry', TimeEntrySchema);
