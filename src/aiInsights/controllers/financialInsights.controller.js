const financialInsightsService = require("../services/financialInsights.service");

async function getFinancialInsights(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Pass req.user.familyId (may be null for personal context)
    const result = await financialInsightsService.getFinancialInsights(req.user.familyId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("getFinancialInsights error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate financial insights" });
  }
}

module.exports = {
  getFinancialInsights
};
