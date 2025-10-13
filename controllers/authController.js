const User = require("../models/User");
const Team = require("../models/Team");
const TokenBlacklist = require("../models/TokenBlacklist");
const OtpEmail = require("../emails/OtpEmail.jsx");
const InviteEmail = require("../emails/InviteEmail.jsx");
const sendEmail = require("../services/send-email");
const ReactDOMServer = require('react-dom/server');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateAccessToken } = require("../utils/token");
require('dotenv').config();

const createAdmin = async (req, res) => {
    const { email, password, full_name, role_title } = req.body;

    if (!email || !password || !full_name || !role_title) {
        return res.status(400).json({ message: "Email, password, full name, and role title are required" });
    }

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser && existingUser.team?.toString() === req.user.team?.toString()) {
            return res.status(400).json({ message: "Admin with this email already exists in your team" });
        }

        const hashedPassword = await hashPassword(password);

        const newAdmin = new User({
            email,
            password: hashedPassword,
            full_name,
            role_title,
            role: 'admin',
            team: req.user.team,
            invitedBy: req.user.id
        });

        await newAdmin.save();

        return res.status(201).json({
            message: "Admin account created successfully",
            user: {
                id: newAdmin._id,
                email: newAdmin.email,
                role: newAdmin.role,
                full_name: newAdmin.full_name,
                role_title: newAdmin.role_title,
                team: newAdmin.team
            }
        });
    } catch (error) {
        console.error("Error creating admin:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const createUserByAdmin = async (req, res) => {
    const { email, password, role, full_name, role_title } = req.body;

    if (!email || !password || !role || !full_name || !role_title) {
        return res.status(400).json({ message: "Email, full name, role title, password, and role are required" });
    }

    const validRoles = ['admin', 'team'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser && existingUser.team?.toString() === req.user.team?.toString()) {
            return res.status(400).json({ message: "User already exists in your team" });
        }

        const hashedPassword = await hashPassword(password);

        const newUser = new User({
            email,
            password: hashedPassword,
            role,
            team: req.user.team,
            role_title,
            full_name,
            invitedBy: req.user.id
        });

        await newUser.save();

        res.status(201).json({
            message: `${role} account created successfully`,
            user: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role,
                full_name: newUser.full_name,
                role_title: newUser.role_title,
                team: newUser.team
            }
        });
    } catch (error) {
        console.error("Error creating user by admin:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateUserRole = async (req, res) => {
    const { userId } = req.params;
    const { newRole } = req.body;

    if (!userId || !newRole) {
        return res.status(400).json({ message: "User ID and new role are required" });
    }

    const validRoles = ['admin', 'team'];
    if (!validRoles.includes(newRole)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    try {
        const user = await User.findOne({ _id: userId, team: req.user.team });

        if (!user) {
            return res.status(404).json({ message: "User not found in your team" });
        }

        user.role = newRole;
        await user.save();

        res.status(200).json({
            message: "User role updated successfully",
            user: {
                id: user._id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                role_title: user.role_title
            }
        });
    } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const inviteUser = async (req, res) => {
    const { full_name, email, role, frontend_url, role_title } = req.body;

    if (!email || !role || !full_name || !role_title || !frontend_url) {
        return res.status(400).json({ message: "Email, role title, frontend url, full name and role are required" });
    }

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser && String(existingUser.team) === String(req.user.team)) {
            return res.status(400).json({ message: "User already exists in your team" });
        }

        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteExpiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;

        const newUser = await User.create({
            full_name,
            email,
            role,
            role_title,
            password: null,
            invitedBy: req.user.id,
            inviteToken,
            inviteExpiresAt,
            team: req.user.team
        });

        const inviter = await User.findById(req.user.id);

        const html = ReactDOMServer.renderToStaticMarkup(
            InviteEmail({
                full_name: newUser.full_name,
                inviteLink: `${frontend_url}?invite=${inviteToken}`,
                invitedBy: inviter?.full_name || "A Techstahr team member"
            })
        );

        await sendEmail({
            to: newUser.email,
            subject: "You're invited to join Techstahr 🎉",
            html
        });

        res.status(201).json({
            message: "Invitation sent successfully",
            user: {
                _id: newUser._id,
                full_name: newUser.full_name,
                email: newUser.email,
                role: newUser.role,
                role_title: newUser.role_title,
                team: newUser.team
            }
        });

    } catch (error) {
        console.error("Invite error:", error);
        res.status(500).json({ message: "Failed to invite user" });
    }
}

const resendInvite = async (req, res) => {
  const { email, frontend_url } = req.body;

  if (!email || !frontend_url) {
    return res.status(400).json({ message: "Email and frontend URL are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.password) {
      return res.status(400).json({ message: "User has already set a password" });
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;

    user.inviteToken = inviteToken;
    user.inviteExpiresAt = inviteExpiresAt;

    await user.save();

    const inviter = await User.findById(user.invitedBy);

    const html = ReactDOMServer.renderToStaticMarkup(
      InviteEmail({
        full_name: user.full_name,
        inviteLink: `${frontend_url}?invite=${inviteToken}`,
        invitedBy: inviter?.full_name || "A Techstahr team member"
      })
    );

    await sendEmail({
      to: user.email,
      subject: "Your Techstahr invite link (resend) 🎉",
      html
    });

    res.status(200).json({ message: "Invitation resent successfully" });

  } catch (error) {
    console.error("Resend invite error:", error);
    res.status(500).json({ message: "Failed to resend invite" });
  }
};

const signup = async (req, res) => {
    const { email, password, full_name, team_name } = req.body;

    if (!email || !password || !team_name) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        const existingTeam = await Team.findOne({ name: team_name.trim() });
        if (existingTeam) {
            return res.status(400).json({ message: "A team with this name already exists" });
        }

        const team = await Team.create({ name: team_name.trim() });

        const hashedPassword = await hashPassword(password);

        const newUser = new User({
            email: normalizedEmail,
            full_name,
            role: "admin",
            password: hashedPassword,
            team: team._id
        });

        await newUser.save();

        const token = generateAccessToken(newUser);

        res.status(201).json({
            message: "User and team created successfully",
            token,
            user: {
                id: newUser._id,
                email: newUser.email,
                full_name: newUser.full_name,
                role: newUser.role,
                team: {
                    id: team._id,
                    name: team.name
                }
            }
        });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

const login = async (req, res) => {
    const { email, password, keepMeLoggedIn } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid password" });
        }

        user.isOnline = true;
        await user.save();

        const expiresIn = keepMeLoggedIn ? '7d' : process.env.JWT_EXPIRATION;
        const token = generateAccessToken(user, expiresIn);

        res.status(200).json({
            message: "Login successful",
            role: user.role,
            token
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user.id;
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized access." });
        }

        await User.findByIdAndUpdate(userId, { isOnline: false, lastLogout: new Date()});
        await TokenBlacklist.create({ 
            userId,
            token, 
            expiresAt: req.user.exp * 1000
        });
        res.status(200).json({ message: "Logout successful", clearToken: true });
    } catch (error) {
        console.error("Error during logout:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const sendOtp = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        await user.save();

        const html = ReactDOMServer.renderToStaticMarkup(
            OtpEmail({ full_name: user.full_name || 'User', otp })
        );

        await sendEmail({
            to: email,
            subject: "Your Techstahr OTP Code",
            html,
        });

        res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.otp !== otp || user.otpExpiresAt < new Date()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const setPassword = async (req, res) => {
  const { token } = req.query;
  const { password } = req.body;

  try {
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    const user = await User.findOne({
      inviteToken: token,
      inviteExpiresAt: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired invite token" });
    }

    user.password = await hashPassword(password);

    user.inviteToken = undefined;
    user.inviteExpiresAt = undefined;

    await user.save();

    res.status(200).json({ message: "Password set successfully. You can now log in." });

  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized access." });
        }
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        const hashedNewPassword = await hashPassword(newPassword);
        user.password = hashedNewPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    const html = ReactDOMServer.renderToStaticMarkup(
      OtpEmail({ full_name: user.full_name || 'User', otp })
    );

    await sendEmail({
      to: email,
      subject: "Reset Your Techstahr Password",
      html,
    });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.otp !== otp || user.otpExpiresAt < new Date()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const hashedPassword = await hashPassword(newPassword);
        user.password = hashedPassword;
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error in resetPassword:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


module.exports = {
    createAdmin,
    createUserByAdmin,
    updateUserRole,
    inviteUser,
    resendInvite,
    signup,
    login,
    logout,
    sendOtp,
    verifyOtp,
    setPassword,
    updatePassword,
    forgotPassword,
    resetPassword
};