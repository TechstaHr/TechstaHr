const Workload = require('../models/Workload');
const WorkloadSetting = require('../models/WorkloadSetting');
const User = require('../models/User');
const MyTask = require('../models/MyTask');

// GET /api/v1/task/workload
const getAllWorkloads = async (req, res) => {
  try {
    const workloads = await Workload.find()
      .populate('user', 'full_name email')
      .populate('task', 'title status')
      .populate('assignedBy', 'full_name email')
      .sort({ createdAt: -1 });

    // build summary per user
    const summary = workloads.reduce((acc, w) => {
      const uid = w.user?._id?.toString() || 'unknown';
      if (!acc[uid]) acc[uid] = { user: w.user || null, totalPoints: 0, tasks: 0, items: [] };
      acc[uid].totalPoints += (w.workloadPoints || 0);
      acc[uid].tasks += 1;
      acc[uid].items.push({
        id: w._id,
        task: w.task,
        status: w.status,
        workloadPoints: w.workloadPoints
      });
      return acc;
    }, {});

    res.status(200).json({ workloads, summary });
  } catch (err) {
    console.error('Error fetching workloads:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/v1/task/workload/assign
const assignWorkload = async (req, res) => {
  try {
    const { userId, taskId, workloadPoints = 1, status = 'Pending' } = req.body;
    if (!userId || !taskId) return res.status(400).json({ message: 'userId and taskId are required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const task = await MyTask.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // enforce user limit if set
    const setting = await WorkloadSetting.findOne({ user: userId });
    if (setting && setting.maxTasksPerUser !== undefined) {
      const activeCount = await Workload.countDocuments({ user: userId, status: { $ne: 'Completed' } });
      if (activeCount >= setting.maxTasksPerUser) {
        return res.status(400).json({ message: 'User has reached max active workload limit' });
      }
    }

    const created = await Workload.create({
      user: userId,
      task: taskId,
      assignedBy: req.user.id,
      status,
      workloadPoints,
      team: req.user.team || undefined,
    });

    res.status(201).json({ message: 'Workload assigned', workload: created });
  } catch (err) {
    console.error('Error assigning workload:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/v1/task/workload/:id
const updateWorkload = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, taskId, status, workloadPoints } = req.body;

    const workload = await Workload.findById(id);
    if (!workload) return res.status(404).json({ message: 'Workload entry not found' });

    if (userId) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'New user not found' });
      workload.user = userId;
    }
    if (taskId) {
      const task = await MyTask.findById(taskId);
      if (!task) return res.status(404).json({ message: 'Task not found' });
      workload.task = taskId;
    }
    if (status) workload.status = status;
    if (workloadPoints !== undefined) workload.workloadPoints = workloadPoints;

    await workload.save();

    const populated = await Workload.findById(workload._id)
      .populate('user', 'full_name email')
      .populate('task', 'title status')
      .populate('assignedBy', 'full_name email');

    res.status(200).json({ message: 'Workload updated', workload: populated });
  } catch (err) {
    console.error('Error updating workload:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/v1/task/workload/:id
const deleteWorkload = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Workload.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Workload entry not found' });
    res.status(200).json({ message: 'Workload removed' });
  } catch (err) {
    console.error('Error deleting workload:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/v1/task/workload/limit/:userId
const getUserLimit = async (req, res) => {
  try {
    const { userId } = req.params;
    const setting = await WorkloadSetting.findOne({ user: userId });
    res.status(200).json({ userId, limit: setting ? setting.maxTasksPerUser : null });
  } catch (err) {
    console.error('Error fetching workload limit:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/v1/task/workload/limit/:userId
const setUserLimit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxTasksPerUser } = req.body;
    if (maxTasksPerUser === undefined) return res.status(400).json({ message: 'maxTasksPerUser is required' });

    const upsert = await WorkloadSetting.findOneAndUpdate(
      { user: userId },
      { $set: { maxTasksPerUser } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: 'Workload limit updated', setting: upsert });
  } catch (err) {
    console.error('Error setting workload limit:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllWorkloads,
  assignWorkload,
  updateWorkload,
  deleteWorkload,
  getUserLimit,
  setUserLimit,
};
