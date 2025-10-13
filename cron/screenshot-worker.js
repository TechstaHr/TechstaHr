const cron = require('node-cron');
const dotenv = require('dotenv');
const takeScreenshotAndUpload = require('../utils/take-screenshot-and-upload');
const MyTask = require('../models/MyTask');
dotenv.config();


if (process.env.ENABLE_SCREENSHOT_CRON === 'true') {
    cron.schedule('* * * * *', async () => {
    const now = new Date();

    console.log(`[⏰] Running screenshot job at ${now.toISOString()}`);

    try {
        const tasks = await MyTask.find({
            enableScreenshot: true,
            nextScreenshotAt: { $lte: now },
        });

        if (tasks.length === 0) {
            console.log("🟡 No tasks due for screenshot.");
            return;
        }

        console.log(`📸 Found ${tasks.length} task(s) due for screenshot.`);

        for (const task of tasks) {
            try {
                await takeScreenshotAndUpload(task);
            } catch (err) {
                console.error(`❌ Error processing task ${task._id}:`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ Failed to fetch tasks:", err.message);
    }
    });
} else {
    console.log('📴 Screenshot cron job is disabled');
}   