const User = require("../models/User");
const MyTask = require("../models/MyTask");
const ProjectTimeLog = require("../models/ProjectTimeLog");

const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getUserStats = async (req, res) => {
  try {
    const teamId = req.user.team;

    const baseQuery = { team: teamId };

    const totalUsers = await User.countDocuments(baseQuery);
    const activeUsers = await User.countDocuments({ ...baseQuery, isOnline: true });
    const pendingInvites = await User.countDocuments({ ...baseQuery, password: null });
    const teamCount = await User.countDocuments({ ...baseQuery, role: 'team' });

    res.json({
      totalUsers,
      activeUsers,
      pendingInvites,
      teamMembers: teamCount
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Failed to load user stats" });
  }
};

const getRoleBreakdown = async (req, res) => {
  try {
    const teamId = req.user.team;

    const roleAggregation = await User.aggregate([
      { $match: { team: teamId } },
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);

    const roleCounts = {};
    roleAggregation.forEach(({ _id, count }) => {
      roleCounts[_id] = count;
    });

    res.json(roleCounts);
  } catch (error) {
    console.error("Error fetching role breakdown:", error);
    res.status(500).json({ message: "Failed to load role data" });
  }
};

const getTeamDirectory = async (req, res) => {
  try {
    const teamId = req.user.team;

    const users = await User.find(
      { team: teamId },
      "full_name email role role_title isOnline avatar team"
    )
      .populate("team", "name")
      .sort({ role: 1, full_name: 1 });

    res.json(users);
  } catch (error) {
    console.error("Error fetching team directory:", error);
    res.status(500).json({ message: "Failed to fetch team directory" });
  }
};

const getPerformanceStats = async (req, res) => {
  try {
    const startOfWeek = getStartOfWeek();
    const teamId = req.user.team;

    const usersInTeam = await User.find({ team: teamId }).select("_id full_name");
    const userIds = usersInTeam.map(u => u._id);

    const taskMatch = {
      updatedAt: { $gte: startOfWeek },
      owner: { $in: userIds }
    };

    const timeLogMatch = {
      startTime: { $gte: startOfWeek },
      durationMinutes: { $ne: null, $gt: 0 },
      user: { $in: userIds }
    };

    const tasksCompleted = await MyTask.countDocuments({
      ...taskMatch,
      status: 'done'
    });

    const productivityScore = await MyTask.aggregate([
      { $match: taskMatch },
      {
        $group: {
          _id: "$owner",
          taskCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$user._id",
          full_name: "$user.full_name",
          taskCount: 1
        }
      }
    ]);

    const timeTracking = await ProjectTimeLog.aggregate([
      { $match: timeLogMatch },
      {
        $group: {
          _id: "$user",
          totalMinutes: { $sum: "$durationMinutes" },
          sessions: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$user._id",
          full_name: "$user.full_name",
          totalMinutes: 1,
          sessions: 1
        }
      }
    ]);

    res.json({
      tasksCompleted,
      productivityScore,
      timeTracking
    });

  } catch (error) {
    console.error("Error fetching performance stats:", error);
    res.status(500).json({ message: "Failed to fetch performance analytics" });
  }
};

module.exports = {
  getUserStats,
  getRoleBreakdown,
  getTeamDirectory,
  getPerformanceStats
};