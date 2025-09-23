const Integration = require('../models/Integration');

const getAllIntegrations = async (req, res) => {
  const integrations = await Integration.find().sort({ createdAt: -1 });
  res.json(integrations);
};

const getIntegration = async (req, res) => {
  const integration = await Integration.findById(req.params.id);
  if (!integration) return res.status(404).json({ message: "Integration not found" });
  res.json(integration);
};

const createIntegration = async (req, res) => {
  const {
    name,
    description,
    screenshot,
    syncStatus,
    connectionStatus,
    webhookURL,
    webhookStatus
  } = req.body;

  if (!name) return res.status(400).json({ message: "Name is required" });

  const exists = await Integration.findOne({ name });
  if (exists) return res.status(409).json({ message: "Integration already exists" });

  const integration = new Integration({
    name,
    description,
    screenshot,
    syncStatus,
    connectionStatus,
    webhookURL,
    webhookStatus
  });

  await integration.save();
  res.status(201).json(integration);
};

const updateIntegration = async (req, res) => {
  const update = await Integration.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  if (!update) return res.status(404).json({ message: "Integration not found" });
  res.json(update);
};

const deleteIntegration = async (req, res) => {
  const deleted = await Integration.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Integration not found" });
  res.json({ message: "Integration removed", integration: deleted });
};

module.exports = {
  getAllIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration
};