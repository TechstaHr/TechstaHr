const puppeteer = require('puppeteer');
const { install, computeExecutablePath } = require('@puppeteer/browsers');
const cloudinary = require('./cloudinary');
const stream = require('stream');
const path = require('path');

const CHROME_BUILD_ID = '140.0.7317.0';
const CHROME_CACHE_DIR = path.resolve(__dirname, '../chrome');
const SCREENSHOT_TIMEOUT = 60000;
const RETRY_LIMIT = 2;

const takeScreenshotAndUpload = async (task) => {
    try {
        await install({
            browser: 'chrome',
            buildId: CHROME_BUILD_ID,
            cacheDir: CHROME_CACHE_DIR,
        });

        const executablePath = await computeExecutablePath({
            browser: 'chrome',
            buildId: CHROME_BUILD_ID,
            cacheDir: CHROME_CACHE_DIR,
        });

        const browser = await puppeteer.launch({
            executablePath,
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(SCREENSHOT_TIMEOUT);
        page.setDefaultTimeout(SCREENSHOT_TIMEOUT);

        let attempt = 0;
        let pageLoaded = false;

        while (attempt < RETRY_LIMIT && !pageLoaded) {
            try {
                await page.goto(task.task_link, {
                    waitUntil: 'networkidle2',
                    timeout: SCREENSHOT_TIMEOUT,
                });
                pageLoaded = true;
            } catch (err) {
                if (err.message.includes('Navigating frame was detached')) {
                    console.warn(`Frame detached on attempt ${attempt + 1}, retrying...`);
                    attempt++;
                } else {
                    throw err;
                }
            }
        }

        if (!pageLoaded) throw new Error('Failed to load page after retries.');

        const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
        await browser.close();

        return await uploadScreenshot(task, screenshotBuffer);
    } catch (error) {
        console.error(`❌ Error processing task ${task._id}: ${error.message}`);
        throw error;
    }
};

    const uploadScreenshot = (task, buffer) => {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'Techstahr/screenshots',
                resource_type: 'image',
                format: 'png',
            },
            async (error, result) => {
                if (error) return reject(error);

                try {
                    task.lastScreenshotUrl = result.secure_url;
                    task.nextScreenshotAt = new Date(Date.now() + task.screenshotIntervalMinutes * 60000);
                    task.screenshotHistory.push(result.secure_url);
                    await task.save();
                    console.log(`✅ Screenshot saved for task "${task.title}"`);
                    resolve(result.secure_url);
                } catch (err) {
                    reject(err);
                }
            }
            );

            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);
            bufferStream.pipe(uploadStream);
        });
    };

module.exports = takeScreenshotAndUpload;