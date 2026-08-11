const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const { getAiInsights } = require("../controllers/aiInsights.controller");
const { getFinancialInsights } = require("../controllers/financialInsights.controller");

router.get("/", authMiddleware, getAiInsights);
router.get("/financial-insights", authMiddleware, getFinancialInsights);

module.exports = router;
