const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkloadSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: Schema.Types.ObjectId, ref: 'MyTask', required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  workloadPoints: { type: Number, default: 1 },
  // optional: keep team if you want to scope later
  team: { type: Schema.Types.ObjectId, ref: 'Team', required: false },
}, { timestamps: true });

module.exports = mongoose.models.Workload || mongoose.model('Workload', WorkloadSchema);
