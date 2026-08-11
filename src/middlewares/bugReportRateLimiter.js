const attempts = new Map();

module.exports = function bugReportRateLimiter(opts = { windowMs: 60 * 60 * 1000, max: 5 }) {
  return (req, res, next) => {
    try {
      const userId = req.user?._id?.toString() || req.user?.id || req.ip || "anonymous";
      const key = `bug-report:${userId}`;
      const now = Date.now();
      const entry = attempts.get(key) || { count: 0, first: now };

      if (now - entry.first > opts.windowMs) {
        entry.count = 0;
        entry.first = now;
      }

      entry.count += 1;
      attempts.set(key, entry);

      if (entry.count > opts.max) {
        return res.status(429).json({ message: "Too many bug reports submitted. Please try again later." });
      }

      next();
    } catch (error) {
      console.error(error);
      next();
    }
  };
};
