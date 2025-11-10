const TimeEntry = require('../models/TimeEntry');
const User = require('../models/User');
const Project = require('../models/Project');

const parseDateSafe = (input) => {
  if (!input) return new Date();
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d;
  
  const parts = input.split('-').map(Number);
  if (parts.length === 3) {
    const [y, m, day] = parts;
    return new Date(y, m - 1, day);
  }
  return new Date();
};

const weekRangeForDate = (date) => {
  const d = new Date(date);
  
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); 
  const diffToMonday = (day === 0) ? -6 : (1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

const getAllTimesheets = async (req, res) => {
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


const getMyTimesheets = async (req, res) => {
  try {
    const userId = req.user.id;
    const dateParam = req.query.date;
    if (dateParam) {
      const date = parseDateSafe(dateParam);
      const start = new Date(date.setHours(0,0,0,0));
      const end = new Date(date.setHours(23,59,59,999));
      const entries = await TimeEntry.find({
        user: userId,
        date: { $gte: start, $lte: end }
      }).populate('project', 'name');

      return res.status(200).json({ date: start.toISOString().split('T')[0], entries });
    }

    
    const entries = await TimeEntry.find({ user: userId })
      .sort({ date: -1 })
      .limit(30)
      .populate('project', 'name');

    res.status(200).json({ entries });
  } catch (err) {
    console.error('Error in getMyTimesheets:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const clockIn = async (req, res) => {
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


const clockOut = async (req, res) => {
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


const submitTimesheet = async (req, res) => {
  try {
    const { entryId } = req.body;
    if (!entryId) return res.status(400).json({ message: 'entryId required' });

    const entry = await TimeEntry.findOne({ _id: entryId, user: req.user.id });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    entry.submitted = true;
    entry.submittedAt = new Date();
    await entry.save();

    res.json({ message: 'Timesheet submitted' });
  } catch (err) {
    console.error('Error in submitTimesheet:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const approveTimesheet = async (req, res) => {
  try {
    const { entryId } = req.body;
    if (!entryId) return res.status(400).json({ message: 'entryId required' });

    const entry = await TimeEntry.findById(entryId).populate('user', 'full_name email');
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    entry.approved = true;
    entry.approvedAt = new Date();
    entry.approvedBy = req.user.id;
    await entry.save();

    res.json({ message: 'Timesheet approved', entry });
  } catch (err) {
    console.error('Error in approveTimesheet:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  clockIn,
  clockOut,
  submitTimesheet,
  getMyTimesheets,
  approveTimesheet,
  getAllTimesheets
};
