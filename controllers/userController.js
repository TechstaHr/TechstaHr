const TimeEntry = require('../models/TimeEntry');
const User = require('../models/User');
const BillingInfo = require('../models/BillingInfo');
const Wallet = require('../models/Wallet');
const Bank = require('../models/Bank');
const moment = require('moment-timezone');
const getAllTimezones = require('../utils/timezones');
const { searchCustomer, createCustomer } = require('../utils/flutterwave');
const crypto = require('crypto');

const getAllUser = async (req, res) => {
  try {
    const teamId = req.user.team;

    const users = await User.find({ team: teamId })
      .select('-password -otp -otpExpiresAt')
      .populate('team', 'name')
      .sort({ role: 1, createdAt: -1 });

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

    const [user, billingInfo] = await Promise.all([
      User.findById(userId).select('-password -__v').populate('flw_customer_id').lean(),
      BillingInfo.findOne({ userId })
    ]);

    if (user && billingInfo && billingInfo.address) {
      user.address = billingInfo.address;
    }

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

    const [user, billing, wallets] = await Promise.all([
      User.findById(userId).select('-password -otp -otpExpiresAt').populate('flw_customer_id'),
      BillingInfo.findOne({ userId }).populate('bankDetail.bankId'),
      Wallet.find({ user: userId }).sort({ currency: 1 })
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let bank = null;
    if (billing?.bankDetail?.bankId) {
      bank = billing.bankDetail.bankId;
    } else if (billing?.bankDetail?.bankId) {
      bank = await Bank.findById(billing.bankDetail.bankId);
    }

    res.status(200).json({
      user,
      billing,
      bank,
      wallets
    });
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

    // Validate address if provided
    let addressToSave = null;
    if (updates.address) {
      if (typeof updates.address === 'string') {
        try {
          updates.address = JSON.parse(updates.address);
        } catch (e) {
          return res.status(400).json({ message: "Invalid address format" });
        }
      }

      const requiredFields = ['street', 'city', 'state', 'postal_code', 'country'];
      const missingFields = requiredFields.filter(field => !updates.address[field]);

      if (missingFields.length > 0) {
        console.log(updates.address)
        return res.status(400).json({
          message: `Address is incomplete. Missing fields: ${missingFields.join(', ')}`
        });
      }
      addressToSave = updates.address;
    }

    // Get current user data before update
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user exists in Flutterwave and create if not
    if (!currentUser.flw_customer_id) {
      try {
        // Search for customer in Flutterwave
        const searchResult = await searchCustomer({
          email: currentUser.email,
          page: 1,
          size: 10,
          traceId: crypto.randomBytes(16).toString('hex')
        });

        console.log('Flutterwave customer search result:', searchResult);

        let flwCustomerId = null;

        // Check if customer exists in search results
        if (searchResult.status === 'success' &&
          searchResult.data &&
          Array.isArray(searchResult.data) &&
          searchResult.data.length > 0) {
          // Customer exists, get the ID
          flwCustomerId = searchResult.data[0].id;
          console.log(`Flutterwave customer found: ${flwCustomerId}`);
        } else {
          // Customer doesn't exist, create new one
          // Use provided address or fall back to billing info
          let addressData = addressToSave;

          if (!addressData) {
            // Try to get address from existing billing info
            const billingInfo = await BillingInfo.findOne({ userId });
            if (billingInfo && billingInfo.address) {
              addressData = billingInfo.address;
            }
          }

          const flwData = {
            email: currentUser.email,
            address: addressData ? {
              city: addressData.city || "",
              country: addressData.country || "NG",
              line1: addressData.street || "",
              postal_code: addressData.postal_code || "",
              state: addressData.state || ""
            } : {
              city: "",
              country: "NG",
              line1: "",
              postal_code: "",
              state: ""
            },
            traceId: crypto.randomBytes(16).toString('hex')
          };

          const createResult = await createCustomer(flwData);

          if (createResult.status === 'success' && createResult.data?.id) {
            flwCustomerId = createResult.data.id;
            console.log(`Flutterwave customer created: ${flwCustomerId}`);
          }
        }

        // Update flw_customer_id if we got one
        if (flwCustomerId) {
          fieldsToUpdate.flw_customer_id = flwCustomerId;
        }
      } catch (flwError) {
        console.error('Flutterwave customer check/creation error:', flwError?.error?.validation_errors || flwError?.message || flwError);
        // Don't fail the profile update if Flutterwave fails
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: fieldsToUpdate },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiresAt');

    // Save or update address in BillingInfo if provided
    let billingResult = null;
    if (addressToSave) {
      try {
        console.log('Attempting to save address to BillingInfo for userId:', userId);

        const existingBilling = await BillingInfo.findOne({ userId });

        if (existingBilling) {
          existingBilling.address = addressToSave;
          const savedBilling = await existingBilling.save();
          console.log('Updated address in existing billing info:', savedBilling._id);
          billingResult = { created: false, id: savedBilling._id };
        } else {
          const billingInfo = new BillingInfo({
            userId,
            address: addressToSave
          });
          const savedBilling = await billingInfo.save();
          console.log('Created new billing info with address:', savedBilling._id);
          billingResult = { created: true, id: savedBilling._id };
        }
      } catch (billingError) {
        console.error("Error details:", {
          name: billingError.name,
          message: billingError.message,
          errors: billingError.errors
        });
        billingResult = { error: billingError.message };
        // Continue even if billing info save fails
      }
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
      addressSaved: addressToSave ? true : false,
      billingInfo: billingResult
    });
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

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Provide form-data key "avatar".' });
    }


    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPG/JPEG/PNG allowed.' });
    }


    const MAX_BYTES = 5 * 1024 * 1024;
    if (req.file.size && req.file.size > MAX_BYTES) {
      return res.status(400).json({ message: 'File too large. Max size is 5MB.' });
    }


    const avatarUrl = req.file.path || req.file.secure_url || req.file.url || (req.file.location && req.file.location) || null;

    if (!avatarUrl) {
      console.error('Upload succeeded but no file URL found on req.file:', req.file);
      return res.status(500).json({ message: 'Upload failed to produce a file URL' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true, select: '-password -otp -otpExpiresAt' }
    ).populate('team', 'name');

    return res.status(200).json({
      message: 'Profile picture uploaded successfully',
      avatar: avatarUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return res.status(500).json({ message: 'Internal server error' });
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
  uploadProfilePicture,
  getUserDetails
};
