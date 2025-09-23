const Ticket = require("../models/Ticket");
const User = require("../models/User");

const createTicket = async (req, res) => {
  try {
    const { complaint, subject } = req.body;
    const ticket = await Ticket.create({ complaint, subject });
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().populate("agent", "full_name email");
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate(
      "agent",
      "full_name email"
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const assignAgent = async (req, res) => {
  try {
    const { agentId } = req.body;
    const user = await User.findById(agentId);

    if (!user) {
      return res.status(400).json({ message: "Not a valid user" });
    }

    if (user.role !== "agent") {
      return res.status(403).json({ message: "User is not an agent" });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { agent: agentId },
      { new: true }
    );
    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateLastMessageTime = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { lastMessageAt: new Date() },
      { new: true }
    );
    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  assignAgent,
  updateTicketStatus,
  updateLastMessageTime,
};
