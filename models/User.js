const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    avatar: String,
    full_name: String,
    public_name: { type: String, trim: true },
    role_title: String,

    region: {
        type: String,
        default: 'Africa/Lagos'
    },
    local_time: String,

    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['admin', 'team'],
        default: 'admin'
    },
    isOnline: { type: Boolean, default: false },

    otp: String,
    otpExpiresAt: Date,

    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inviteToken: String,
    inviteExpiresAt: Date,

    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team"
    },

    flw_customer_id: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

UserSchema.index({ email: 1, team: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);