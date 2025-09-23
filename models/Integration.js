const mongoose = require("mongoose");

const IntegrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  screenshot: { type: String },
  syncStatus: { type: String },
  connectionStatus: {
    type: String,
    enum: ['Connected', 'Disconnected'],
    default: 'Disconnected'
  },
  webhookURL: { type: String, required: false },
  webhookStatus: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Inactive'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Integration", IntegrationSchema);
