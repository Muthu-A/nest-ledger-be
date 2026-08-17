const aiInsightsService = require("../services/aiInsights.service");

async function getAiInsights(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Allow personal context by passing null familyId
    const result = await aiInsightsService.getInsightsForFamily(req.user.familyId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("getAiInsights error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate AI insights" });
  }
}

module.exports = {
  getAiInsights
};
