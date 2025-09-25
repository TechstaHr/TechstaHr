const TimeEntry = require('../models/TimeEntry');
const User = require('../models/User');
const Project = require('../models/Project');
const MyTask = require('../models/MyTask');
const takeScreenshotAndUpload = require('../utils/take-screenshot-and-upload');


exports.clockIn = async (req, res) => {
  try {
  const { projectId } = req.body;
  const userId = req.user._id || req.user.id;

    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    
  // prevent multiple open clock-ins across any project for the same user
  const existing = await TimeEntry.findOne({ user: userId, endTime: null });
  if (existing) return res.status(400).json({ message: 'Already clocked in. Please clock out first.' });

    const entry = new TimeEntry({
      user: userId,
      project: projectId,
      date: new Date(),
      startTime: new Date(),
      status: 'pending'
    });

    await entry.save();
    // trigger a one-off screenshot for any enabled tasks for this user (async, non-blocking)
    (async () => {
      try {
        const tasks = await MyTask.find({ owner: userId, enableScreenshot: true });
        for (const task of tasks) {
          // fire-and-forget
          takeScreenshotAndUpload(task).catch(err => console.warn('screenshot on clock-in failed', err.message));
        }
      } catch (err) {
        console.warn('Failed to trigger screenshots on clock-in:', err.message);
      }
    })();

    res.status(201).json(entry);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error clocking in', error: error.message });
  }
};


exports.clockOut = async (req, res) => {
  try {
    const { entryId } = req.body;

    // allow clocking out by entryId or by the current open entry
    let entry;
    if (entryId) {
      entry = await TimeEntry.findById(entryId).populate('user', 'name email').populate('project', 'name');
    } else {
      const userId = req.user._id || req.user.id;
      entry = await TimeEntry.findOne({ user: userId, endTime: null }).populate('user', 'name email').populate('project', 'name');
    }

    if (!entry) return res.status(400).json({ message: 'No active clock-in found' });
    if (entry.endTime) return res.status(400).json({ message: 'This entry is already clocked out' });

    entry.endTime = new Date();

    const ms = entry.endTime - entry.startTime;
    const hours = ms / (1000 * 60 * 60);

    // round to 2 decimal places for readability and payroll accuracy
    const totalHours = Number(hours.toFixed(2));
    entry.totalHours = totalHours;
    entry.regularHours = Number(Math.min(totalHours, 8).toFixed(2));
    entry.overtimeHours = Number((totalHours > 8 ? totalHours - 8 : 0).toFixed(2));

    await entry.save();
    // trigger screenshots for any enabled tasks for this user (async)
    (async () => {
      try {
        const tasks = await MyTask.find({ owner: entry.user, enableScreenshot: true });
        for (const task of tasks) {
          takeScreenshotAndUpload(task).catch(err => console.warn('screenshot on clock-out failed', err.message));
        }
      } catch (err) {
        console.warn('Failed to trigger screenshots on clock-out:', err.message);
      }
    })();

    res.json(entry);

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

  // only owner can submit
  const requesterId = req.user._id || req.user.id;
  if (String(entry.user) !== String(requesterId)) return res.status(403).json({ message: 'Not authorized to submit this timesheet' });

    // must be clocked out before submission
    if (!entry.endTime) return res.status(400).json({ message: 'Please clock out before submitting timesheet' });

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
    const userId = req.user._id || req.user.id;

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


exports.getActiveEntry = async (req, res) => {
  try {
  const userId = req.user._id || req.user.id;
  const entry = await TimeEntry.findOne({ user: userId, endTime: null }).populate('project', 'name');
    if (!entry) return res.status(404).json({ message: 'No active entry' });
    res.json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching active entry', error: error.message });
  }
};

// generate a simple report: total hours per user in a date range
exports.generateReport = async (req, res) => {
  try {
    const { from, to } = req.query; // ISO dates yyyy-mm-dd
    const start = from ? new Date(from) : new Date(0);
    const end = to ? new Date(to) : new Date();

    // include entire 'to' day
    end.setHours(23,59,59,999);

    const entries = await TimeEntry.find({ date: { $gte: start, $lte: end }, endTime: { $ne: null } })
      .populate('user', 'full_name email')
      .populate('project', 'name');

    const report = {};
    for (const e of entries) {
      const uid = e.user._id.toString();
      if (!report[uid]) report[uid] = { user: e.user, totalHours: 0, entries: [] };
      report[uid].totalHours += e.totalHours || 0;
      report[uid].entries.push({ entryId: e._id, project: e.project.name, date: e.date, hours: e.totalHours });
    }

    res.json({ from: start.toISOString(), to: end.toISOString(), report });
  } catch (err) {
    console.error('Error generating report:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.attachScreenshots = async (req, res) => {
  try {
    const { entryId, screenshots } = req.body; // screenshots: [url1, url2, ...]
    if (!entryId || !Array.isArray(screenshots)) return res.status(400).json({ message: 'entryId and screenshots[] are required' });

    const entry = await TimeEntry.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

  const items = screenshots.map(u => ({ url: u, takenAt: new Date() }));
  entry.screenshots = (entry.screenshots || []).concat(items);
    await entry.save();

    res.json({ message: 'Screenshots attached', entry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error attaching screenshots', error: error.message });
  }
};
