const jwt = require("jsonwebtoken");
const TokenBlacklist = require("../models/TokenBlacklist");

// ✅ Secure async middleware wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const blacklisted = await TokenBlacklist.findOne({ token });
  if (blacklisted) {
    return res.status(401).json({
      message: "Token has been revoked. Please log in again.",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }

  req.user = decoded;
  return next();
});

const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Access denied. Admins only." });
  }
  return next();
};

const authorizeAgent = (req, res, next) => {
  if (!req.user || req.user.role !== "agent") {
    return res
      .status(403)
      .json({ error: "Access denied. Agents only." });
  }
  return next();
};

const checkTokenBlacklisted = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const blacklisted = await TokenBlacklist.findOne({ token });
  if (blacklisted) {
    return res
      .status(401)
      .json({ message: "Token has been revoked. Please log in again." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }

  req.user = decoded;
  return next();
});

module.exports = {
  authenticateToken,
  authorizeAdmin,
  authorizeAgent,
  checkTokenBlacklisted,
};