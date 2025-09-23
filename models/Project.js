const mongoose = require("mongoose");

const IssueSchema = new mongoose.Schema({
  title: String,
  description: String,
  message: String,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  resolved: { type: Boolean, default: false },
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  replies: [
    {
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  teamMembers: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  issues: [IssueSchema],
  comments: [CommentSchema],
  progress: { type: Number, default: 0 },
  deadline: Date,
  startTime: Date,
  endTime: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ProjectSchema.virtual('tasks', {
  ref: 'MyTask',
  localField: '_id',
  foreignField: 'project'
});

module.exports = mongoose.model("Project", ProjectSchema);