const express = require("express");
const router = express.Router();
const peopleController = require("../controllers/peopleController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.get("/stats", authenticateToken, peopleController.getUserStats);
router.get("/roles", authenticateToken, peopleController.getRoleBreakdown);
router.get("/directory", authenticateToken, peopleController.getTeamDirectory);
router.get("/performance", authenticateToken, peopleController.getPerformanceStats);

module.exports = router;