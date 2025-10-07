const TimeEntry = require('../models/TimeEntry');
const User = require('../models/User');
const Project = require('../models/Project');


exports.clockIn = async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    
    const existing = await TimeEntry.findOne({ user: userId, project: projectId, endTime: null });
    if (existing) return res.status(400).json({ message: 'Already clocked in for this project' });

    const entry = new TimeEntry({
      user: userId,
      project: projectId,
      date: new Date(),
      startTime: new Date(),
      status: 'pending'
    });

    await entry.save();
    res.status(201).json({ message: "Clocked in successfully", entry });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error clocking in', error: error.message });
  }
};


exports.clockOut = async (req, res) => {
  try {
    const { entryId } = req.body;

    const entry = await TimeEntry.findById(entryId)
      .populate('user', 'name email')
      .populate('project', 'name');

    if (!entry || entry.endTime) return res.status(400).json({ message: 'No active clock-in found' });

    entry.endTime = new Date();

    
    const ms = entry.endTime - entry.startTime;
    const hours = ms / (1000 * 60 * 60);

    entry.totalHours = hours;
    entry.regularHours = Math.min(hours, 8);
    entry.overtimeHours = hours > 8 ? hours - 8 : 0;

    await entry.save();
    res.status(200).json({
      message: "Clocked out successfully",
      entry: entry
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error clocking out', error: error.message });
  }
};


exports.submitTimesheet = async (req, res) => {
  try {
    const { entryId } = req.body;

    const entry = await TimeEntry.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Timesheet not found' });

    entry.status = 'submitted';
    await entry.save();

    res.json({ message: 'Timesheet submitted successfully', entry });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting timesheet', error: error.message });
  }
};


exports.approveTimesheet = async (req, res) => {
  try {
    const { entryId } = req.body;

    const entry = await TimeEntry.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Timesheet not found' });

    entry.status = 'approved';
    await entry.save();

    res.json({ message: 'Timesheet approved', entry });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error approving timesheet', error: error.message });
  }
};


exports.getMyTimesheets = async (req, res) => {
  try {
    const userId = req.user.id;

    const timesheets = await TimeEntry.find({ user: userId })
      .populate('project', 'name')
      .sort({ date: -1 });

    res.json(timesheets);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching timesheets', error: error.message });
  }
};


exports.getAllTimesheets = async (req, res) => {
  try {
    const timesheets = await TimeEntry.find()
      .populate('user', 'name email')
      .populate('project', 'name')
      .sort({ date: -1 });

    res.json(timesheets);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching all timesheets', error: error.message });
  }
};
