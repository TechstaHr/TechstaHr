const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

router.post('/', ticketController.createTicket);
router.get('/', ticketController.getAllTickets);
router.get('/:id', ticketController.getTicketById);
router.put('/:id/assign', ticketController.assignAgent);
router.put('/:id/status', ticketController.updateTicketStatus);
router.put('/:id/last-message', ticketController.updateLastMessageTime);

module.exports = router;
