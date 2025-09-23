const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    complaint: { type: String, required: true },
    subject: { type: String, required: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
        type: String,
        enum: ['opened', 'closed', 'solved'],
        default: 'opened'
    },
    lastMessageAt: { type: Date, default: Date.now },
    }, {
    timestamps: true
});

module.exports = mongoose.model('Ticket', ticketSchema);
