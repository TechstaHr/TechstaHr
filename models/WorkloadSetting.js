const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkloadSettingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  maxTasksPerUser: { type: Number, default: 5 },
}, { timestamps: true });

module.exports = mongoose.models.WorkloadSetting || mongoose.model('WorkloadSetting', WorkloadSettingSchema);
