// Parses `req.query.month` (YYYY-MM) into startDate/endDate and attaches to req.monthRange
module.exports = (req, res, next) => {
  try {
    const monthParam = req.query.month;

    const now = new Date();
    let year, month;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split("-").map((v) => parseInt(v, 10));
    } else if (!monthParam) {
      year = now.getFullYear();
      month = now.getMonth() + 1;
      // set default month query so controllers that expect `month` still work
      req.query.month = `${year}-${String(month).padStart(2, "0")}`;
    } else {
      return res.status(400).json({ success: false, message: "Invalid month format. Use YYYY-MM" });
    }

    // Build start and end dates for the month (UTC-safe)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    req.monthRange = {
      year,
      month,
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      startDate,
      endDate
    };

    // For report endpoints that accept startDate/endDate, provide them when month is used
    if (req.query.month) {
      // Only overwrite if client didn't already pass explicit startDate/endDate
      if (!req.query.startDate && !req.query.endDate) {
        req.query.startDate = startDate.toISOString();
        req.query.endDate = endDate.toISOString();
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
