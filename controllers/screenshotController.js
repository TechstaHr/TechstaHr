const Project = require('../models/Project');
const Notifications = require('../models/Notifications');
const cloudinary = require('../utils/cloudinary');

const setScreenshotSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { screenshotIntervalMinutes, enableScreenshot } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.screenshotSettings = {
      ...project.screenshotSettings,
      enabled: enableScreenshot,
      intervalMinutes: screenshotIntervalMinutes
    };

    await project.save();

    res.status(200).json({ message: 'Screenshot settings updated', settings: project.screenshotSettings });
  } catch (error) {
    console.error('Error updating screenshot settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const stopScreenshot = async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found." });
        }

        project.screenshotSettings.enabled = false;
        project.screenshotSettings.intervalMinutes = undefined;

        await project.save();

        res.status(200).json({ message: "Screenshot capturing stopped", project });
    } catch (err) {
        console.error("Error stopping screenshot:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getProjectScreenshots = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId)
      .select('screenshotHistory screenshotSettings name');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.status(200).json({
      projectName: project.name,
      settings: project.screenshotSettings,
      screenshots: project.screenshotHistory || []
    });
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const generateUploadSignature = async (req, res) => {
  try {
    const { projectId } = req.params;
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request({
      timestamp: timestamp,
      folder: `Techstahr/screenshots/project_${projectId}`,
    }, process.env.CLOUDINARY_API_SECRET);

    res.json({
      uploadSignature: {
        timestamp,
        signature,
        folder: `Techstahr/screenshots/project_${projectId}`,
        apiKey: process.env.CLOUDINARY_API_KEY
      }
    });
  } catch (error) {
    console.error('Error generating signature:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const notifyUploadCompletion = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { imageUrl } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Add to project's screenshot history
    if (!project.screenshotHistory) project.screenshotHistory = [];
    project.screenshotHistory.push({
      url: imageUrl,
      takenAt: new Date(),
      takenBy: req.user.id
    });

    await project.save();

    // Create notification
    await Notifications.create({
      type: 'screenshot_uploaded',
      message: `New screenshot uploaded for project "${project.name}"`,
      recipient: project.createdBy,
      link: `/projects/${projectId}/screenshots`,
      metadata: {
        projectId,
        screenshotUrl: imageUrl,
        uploadedBy: req.user.id
      }
    });

    res.status(200).json({
      message: 'Screenshot upload recorded',
      screenshot: project.screenshotHistory[project.screenshotHistory.length - 1]
    });
  } catch (error) {
    console.error('Error recording screenshot upload:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  setScreenshotSettings,
  stopScreenshot,
  getProjectScreenshots,
  generateUploadSignature,
  notifyUploadCompletion
};
