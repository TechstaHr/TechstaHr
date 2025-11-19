const cron = require("node-cron");
const ReactDOMServer = require("react-dom/server");
const Project = require("../models/Project");
const NotificationSettings = require("../models/NotificationSettings");
const Notifications = require("../models/Notifications");
const DeadlineReminderEmail = require("../emails/DeadlineReminderEmail.jsx");
const sendEmail = require("../services/send-email");

cron.schedule("0 9 * * *", async () => {
    const now = new Date();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(now.getDate() + 2);

    try {
        const projects = await Project.find({
        deadline: { $lte: twoDaysFromNow, $gte: now },
        }).populate("teamMembers.user");

        for (const project of projects) {
        for (const memberObj of project.teamMembers) {
            const member = memberObj.user;
            if (!member) continue;

            const settings = await NotificationSettings.findOne({ user: member._id });

            const shouldNotifyInApp =
            !settings || settings.task_assigned_notification !== false;

            const shouldNotifyByEmail =
            !settings || settings.email_notification !== false;

            if (shouldNotifyInApp) {
            await Notifications.create({
                recipient: member._id,
                type: "task_assigned",
                message: `Reminder: Project "${project.name}" deadline is approaching (${project.deadline.toDateString()}).`,
                link: `/projects/${project._id}`,
            });
            }

            if (shouldNotifyByEmail) {
            const html = ReactDOMServer.renderToStaticMarkup(
                DeadlineReminderEmail({
                full_name: member.full_name,
                projectName: project.name,
                deadline: project.deadline.toDateString(),
                })
            );

            await sendEmail({
                to: member.email,
                subject: `⏰ Project "${project.name}" Deadline Reminder`,
                html,
            });
            }
        }
        }
    } catch (error) {
        console.error("❌ Error in deadline reminder job:", error);
    }
});