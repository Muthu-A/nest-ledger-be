const express = require("express");
const router = express.Router();
const { getDashboardSummary, getRecentTransactions, getMonthlyExpenses } = require("../controllers/dashboard.controller");

router.get("/summary", getDashboardSummary);
router.get("/recent", getRecentTransactions);
router.get("/monthly-expenses", getMonthlyExpenses);

module.exports = router;
