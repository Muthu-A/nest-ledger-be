const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function (req, res, next) {
  try {
    const auth = req.headers.authorization;
    // debug: log path and whether auth header present (do NOT log token value)
    console.debug(`[auth] ${req.method} ${req.path} authHeaderPresent=${!!auth}`);
    if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ message: "No token provided" });
    const token = auth.split(" ")[1];
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("CRITICAL: JWT_SECRET is not configured");
      return res.status(500).json({ success: false, error: "Server misconfiguration", code: "SERVER_ERROR" });
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    // debug: log decoded id if present
    if (decoded && decoded.id) console.debug(`[auth] decodedId=${decoded.id}`);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] middleware error:', err.message || err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
