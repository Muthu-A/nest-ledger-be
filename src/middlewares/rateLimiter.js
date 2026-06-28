const attempts = new Map();

// Simple in-memory rate limiter for auth endpoints
// opts: { windowMs, max }
module.exports = function rateLimiter(opts = { windowMs: 15 * 60 * 1000, max: 5 }) {
  return (req, res, next) => {
    try {
      const key = (req.ip || req.connection.remoteAddress) + ":" + req.originalUrl;
      const now = Date.now();
      const entry = attempts.get(key) || { count: 0, first: now };
      if (now - entry.first > opts.windowMs) {
        // reset
        entry.count = 0;
        entry.first = now;
      }
      entry.count += 1;
      attempts.set(key, entry);
      if (entry.count > opts.max) {
        return res.status(429).json({ message: "Too many requests. Try again later." });
      }
      next();
    } catch (err) {
      console.error(err);
      next();
    }
  };
};
