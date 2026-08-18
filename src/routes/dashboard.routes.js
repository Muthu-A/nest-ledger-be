const express = require("express");
const router = express.Router();
const { getDashboardSummary, getRecentTransactions, getMonthlyExpenses } = require("../controllers/dashboard.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/summary", auth, getDashboardSummary);
router.get("/recent", auth, getRecentTransactions);
router.get("/monthly-expenses", auth, getMonthlyExpenses);

module.exports = router;
