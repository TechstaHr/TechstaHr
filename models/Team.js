const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, {
    timestamps: true
});

module.exports = mongoose.model("Team", TeamSchema);