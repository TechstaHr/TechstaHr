const ProjectTimeLog = require('../models/ProjectTimeLog');
const User = require('../models/User');
const moment = require('moment');

const getAllUsersProductivity = async (req, res) => {
    try {
        const startOfWeek = moment().startOf('isoWeek').toDate();
        const endOfWeek = moment().endOf('isoWeek').toDate();
        const isAdmin = req.user.role === 'admin';

        const matchQuery = {
            startTime: { $gte: startOfWeek, $lte: endOfWeek },
            endTime: { $ne: null }
        };

        if (!isAdmin) {
            matchQuery.user = req.user.id;
        }

        const logs = await ProjectTimeLog.find(matchQuery)
            .populate('user', 'full_name email');

        const productivityMap = new Map();

        logs.forEach(log => {
            if (!log.user) return;

            const day = moment(log.startTime).format('dddd');
            if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) return;

            const userId = log.user._id.toString();

            if (!productivityMap.has(userId)) {
                productivityMap.set(userId, {
                    user: log.user,
                    productivity: {
                        Monday: 0,
                        Tuesday: 0,
                        Wednesday: 0,
                        Thursday: 0,
                        Friday: 0
                    }
                });
            }

            const userData = productivityMap.get(userId);
            userData.productivity[day] += log.durationMinutes || 0;
        });

        const result = Array.from(productivityMap.values());

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching all users productivity:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getUserWeeklyProductivity = async (req, res) => {
    const { id } = req.params;

    try {
        const requesterId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Uncomment this if you want to restrict users from seeing others' data
        // if (!isAdmin && requesterId !== id) {
        //     return res.status(403).json({ message: "Unauthorized access to this user's data" });
        // }

        const startOfWeek = moment().startOf('isoWeek').toDate();
        const endOfWeek = moment().endOf('isoWeek').toDate();

        const logs = await ProjectTimeLog.find({
            user: id,
            startTime: { $gte: startOfWeek, $lte: endOfWeek },
            endTime: { $ne: null }
        });

        const productivity = {
            Monday: 0,
            Tuesday: 0,
            Wednesday: 0,
            Thursday: 0,
            Friday: 0
        };

        logs.forEach(log => {
            const day = moment(log.startTime).format('dddd');
            if (productivity.hasOwnProperty(day)) {
                productivity[day] += log.durationMinutes || 0;
            }
        });

        res.status(200).json({ userId: id, productivity });
    } catch (error) {
        console.error("Error fetching productivity:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getAllUsersProductivity,
    getUserWeeklyProductivity
};