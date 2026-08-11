const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const { getFinancialInsights } = require("../controllers/financialInsights.controller");

router.get("/", authMiddleware, getFinancialInsights);

module.exports = router;
