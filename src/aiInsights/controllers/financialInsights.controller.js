const financialInsightsService = require("../services/financialInsights.service");

async function getFinancialInsights(req, res) {
  try {
    if (!req.user?.familyId) {
      return res.status(403).json({ success: false, message: "Family context required" });
    }

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
