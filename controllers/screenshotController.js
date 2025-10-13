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

const generateUploadSignature = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ message: "Task ID is required." });
    }

    const userId = req.user.id;
    const folderName = `Techstahr/screenshots/tasks/${taskId}/${userId}`;
    const timestamp = Math.round((new Date).getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folderName,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      message: "Upload signature generated successfully",
      uploadSignature: {
        timestamp,
        signature,
        folder: folderName,
        apiKey: process.env.CLOUDINARY_API_KEY,
      },
    });
  } catch (err) {
    console.error("Error generating upload signature:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const notifyUploadCompletion = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { imageUrl } = req.body;
    const userId = req.user.id;
    const task = await MyTask.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const timeEntry = await TimeEntry.findOne({
      user: userId,
      project: task.project,
      date: { $gte: startOfDay }
    });
    if (!timeEntry) return res.status(404).json({ message: "No time entry found." });
    task.lastScreenshotUrl = imageUrl;
    task.screenshotHistory.push(imageUrl);
    timeEntry.screenshots.push(imageUrl);
    
    await task.save();
    await timeEntry.save();

    res.status(200).json({ message: 'Screenshot URL saved successfully.' });
  } catch (err) {
    console.error("Error saving screenshot URL:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
    setScreenshotSettings,
    stopScreenshot,
    getTaskScreenshots,
    generateUploadSignature,
    notifyUploadCompletion
};
