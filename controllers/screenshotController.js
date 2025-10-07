const MyTask = require('../models/MyTask');
const TimeEntry = require('../models/TimeEntry')
const cloudinary = require('../utils/cloudinary');

const setScreenshotSettings = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { enableScreenshot, screenshotIntervalMinutes } = req.body;

        if (enableScreenshot && (!screenshotIntervalMinutes || screenshotIntervalMinutes < 1)) {
            return res.status(400).json({ message: "Valid screenshot interval is required." });
        }

        const task = await MyTask.findById(taskId);

        if (!task) return res.status(404).json({ message: "Task not found." });

        task.enableScreenshot = enableScreenshot;
        task.screenshotIntervalMinutes = screenshotIntervalMinutes;

        if (enableScreenshot) {
            task.nextScreenshotAt = new Date(Date.now() + screenshotIntervalMinutes * 60000);
        } else {
            task.nextScreenshotAt = null;
        }

        await task.save();

        res.status(200).json({ message: "Screenshot settings updated", task });
    } catch (err) {
        console.error("Error setting screenshot settings:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const stopScreenshot = async (req, res) => {
    try {
        const { taskId } = req.params;

        const task = await MyTask.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found." });
        }

        task.enableScreenshot = false;
        task.nextScreenshotAt = null;
        task.screenshotIntervalMinutes = undefined;

        await task.save();

        res.status(200).json({ message: "Screenshot capturing stopped", task });
    } catch (err) {
        console.error("Error stopping screenshot:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getTaskScreenshots = async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await MyTask.findById(taskId).select('title screenshotHistory lastScreenshotUrl');

        if (!task) return res.status(404).json({ message: "Task not found." });

        res.status(200).json({
            title: task.title,
            lastScreenshot: task.lastScreenshotUrl,
            history: task.screenshotHistory,
        });
    } catch (err) {
        console.error("Error fetching screenshot history:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const uploadScreenshot = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await MyTask.findById(taskId)
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }
    const userId = req.user.id;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endofDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const timeEntry = await TimeEntry.findOne({
      user: userId,
      project: task.project,
      date: {
        $gte: startOfDay,
        $lt: endofDay
      }
    });
    if (!timeEntry) {
      return res.status(404).json({ message: "No time entry found for this task." })
    }
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: "No image data provided." });
    }
    const timestamp = new Date().getTime();
    const folderName = `tasks/${taskId}/${userId}`;
    const result = await cloudinary.uploader.upload(
      image,
      {
        asset_folder:folderName,
        folder:folderName,
      }
    );
    task.lastScreenshotUrl = result.secure_url;
    task.screenshotHistory.push(result.secure_url);
    timeEntry.screenshots.push(result.secure_url);
    await task.save();
    await timeEntry.save();
    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: result.secure_url,
    });
  } catch (err) {
    console.error("Error occurred while uploading screenshot:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
    setScreenshotSettings,
    stopScreenshot,
    getTaskScreenshots,
<<<<<<< HEAD
    getEntryScreenshots: async (req, res) => {
        try {
            const { entryId } = req.params;
            const TimeEntry = require('../models/TimeEntry');

            const entry = await TimeEntry.findById(entryId).populate('user', 'name email').populate('project', 'name');
            if (!entry) return res.status(404).json({ message: 'Timesheet entry not found.' });

            // allow owner or admin
            if (!(req.user && (String(req.user._id) === String(entry.user._id) || req.user.role === 'admin'))) {
                return res.status(403).json({ message: 'Not authorized to view screenshots for this entry.' });
            }

            res.status(200).json({
                entryId: entry._id,
                user: entry.user,
                project: entry.project,
                screenshots: entry.screenshots || []
            });
        } catch (err) {
            console.error('Error fetching entry screenshots:', err.message);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};
=======
    uploadScreenshot
};
>>>>>>> origin/paul/feature-screenshot
