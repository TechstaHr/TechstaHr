const TimeEntry = require('../models/TimeEntry');
const User = require('../models/User');
const moment = require('moment-timezone');
const getAllTimezones = require('../utils/timezones');

const getAllUser = async (req, res) => {
    try {
        const teamId = req.user.team;

        const users = await User.find({ team: teamId })
            .select('-password -otp -otpExpiresAt')
            .populate('team', 'name')
            .sort({ role: 1, createdAt: -1 }); // Sort by role, then by creation date

        res.json({ 
            users,
            count: users.length,
            teamId: teamId
        });
    } catch (error) {
        console.error("Error getting users:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId)
            .select('-password -__v')
            .populate('team', 'name');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        const allowedUpdates = ['full_name', 'public_name', 'role_title', 'local_time'];
        const fieldsToUpdate = {};

        for (let key of allowedUpdates) {
            if (updates[key] !== undefined) {
                fieldsToUpdate[key] = updates[key];
            }
        }

        if (req.file && req.file.path) {
            fieldsToUpdate.avatar = req.file.path;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: fieldsToUpdate },
            { new: true, runValidators: true }
        ).select('-password -otp -otpExpiresAt');

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const changeUserRole = async (req, res) => {
    const validRoles = ['admin', 'user', 'team', 'agent'];
    const { id } = req.params;
    const { role } = req.body;

    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role provided' });
    }

    try {
        const userToUpdate = await User.findOne({ _id: id, team: req.user.team });

        if (!userToUpdate) {
            return res.status(404).json({ message: 'User not found or not in your team' });
        }

        userToUpdate.role = role;
        await userToUpdate.save();

        const updatedUser = await User.findById(id).select('-password -__v');
        res.status(200).json({ message: 'User role updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Error changing user role:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteUserAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findOne({ _id: id, team: req.user.team });
        if (!user) {
            return res.status(404).json({ message: "User not found or not in your team" });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ message: "Admin account cannot be deleted!" });
        }

        await User.findByIdAndDelete(id);
        res.status(200).json({ message: `User account deleted successfully` });
    } catch (error) {
        console.error(`Error deleting user account:`, error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteMyAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ message: "Admin account cannot be self-deleted!" });
        }

        await User.findByIdAndDelete(userId);
        res.status(200).json({ message: "User account deleted successfully" });
    } catch (error) {
        console.error("Error deleting user account:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const clockInOrManualEntry = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  const now = new Date();

  const start = new Date();

  const entryDate = new Date(now.toDateString());

  const existing = await TimeEntry.findOne({ user: userId, project: projectId, date: entryDate });
  if (existing) {
    return res.status(400).json({ message: "You already clocked in today" });
  }

  const entry = await TimeEntry.create({
    user: userId,
    project: projectId,
    date: entryDate,
    startTime: start
  });

  res.status(201).json({ message: "Clocked in successfully", entry });
};

const clockOut = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const entry = await TimeEntry.findOne({
      user: userId,
      project: projectId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!entry) {
      return res.status(404).json({ message: "No clock-in record found for today" });
    }

    if (entry.endTime) {
      return res.status(400).json({ message: "You have already clocked out today" });
    }

    const now = new Date();

    const diffMs = now - entry.startTime;
    const total = diffMs / (1000 * 60 * 60);
    const regular = Math.min(8, total);
    const overtime = Math.max(0, total - 8);

    entry.endTime = now;
    entry.totalHours = total;
    entry.regularHours = regular;
    entry.overtimeHours = overtime;

    await entry.save();

    res.status(200).json({
      message: "Clocked out successfully",
      timeEntry: {
        totalHours: total.toFixed(2),
        regularHours: regular.toFixed(2),
        overtimeHours: overtime.toFixed(2),
        endTime: now
      }
    });

  } catch (error) {
    console.error("Clock-out error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const adminClockOutUser = async (req, res) => {
  const { projectId, userId } = req.params;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  if (!userId || !projectId) {
    return res.status(400).json({ message: "userId and projectId are required" });
  }

  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const entry = await TimeEntry.findOne({
      user: userId,
      project: projectId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!entry) {
      return res.status(404).json({ message: "No clock-in record found for today" });
    }

    if (entry.endTime) {
      return res.status(400).json({ message: "User has already clocked out today" });
    }

    const diffMs = now - entry.startTime;
    const total = diffMs / (1000 * 60 * 60);
    const regular = Math.min(8, total);
    const overtime = Math.max(0, total - 8);

    entry.endTime = now;
    entry.totalHours = total;
    entry.regularHours = regular;
    entry.overtimeHours = overtime;

    await entry.save();

    res.status(200).json({
      message: "User clocked out successfully by admin",
      timeEntry: {
        totalHours: total.toFixed(2),
        regularHours: regular.toFixed(2),
        overtimeHours: overtime.toFixed(2),
        endTime: now,
      },
    });

  } catch (error) {
    console.error("Admin clock-out error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const listTimezones = (req, res) => {
  try {
    const zones = getAllTimezones();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load timezones' });
  }
};

const updateRegion = async (req, res) => {
  try {
    const { region } = req.body;

    if (!region || !moment.tz.zone(region)) {
      return res.status(400).json({ message: 'Invalid or missing time zone region' });
    }

    const localTime = moment().tz(region).format('YYYY-MM-DD HH:mm:ss');

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        region,
        local_time: localTime
      },
      { new: true }
    );

    res.json({
      message: 'Region and local time updated',
      region: updatedUser.region,
      local_time: updatedUser.local_time
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllUser,
  getUserProfile,
  updateUserProfile,
  changeUserRole,
  deleteMyAccount,
  deleteUserAccount,
  clockInOrManualEntry,
  clockOut,
  adminClockOutUser,
  listTimezones,
  updateRegion,
  getUserDetails 
};
