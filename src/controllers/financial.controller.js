const financialPlannerService = require("../services/financialPlanner.service");

exports.getPlannerData = async (req, res) => {
  try {
    // Only use monthKey when client explicitly passed `?month=` in the query
    const monthProvided = (req.originalUrl || req.url || "").includes("month=");
    const monthKey = monthProvided ? req.monthRange?.monthKey : undefined;
    const data = await financialPlannerService.getPlannerData(monthKey);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch planner data"
    });
  }
};
