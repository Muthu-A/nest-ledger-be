const express = require("express");
const router = express.Router();
const {
  createInvestment,
  getInvestments,
  getInvestmentById,
  updateInvestment,
  deleteInvestment,
  getDashboard,
  getAllocation,
  getMonthlyTrend,
  getRecentInvestments,
  getUpcomingReminders,
  getStatistics,
  duplicateInvestment
} = require("../controllers/investment.controller");
const auth = require("../middlewares/auth.middleware");

// Dashboard routes (must be before /:id routes)
router.get("/dashboard", auth, getDashboard);
router.get("/allocation", auth, getAllocation);
router.get("/monthly-trend", auth, getMonthlyTrend);
router.get("/recent", auth, getRecentInvestments);
router.get("/reminders", auth, getUpcomingReminders);
router.get("/statistics", auth, getStatistics);

// CRUD routes
router.get("/", auth, getInvestments);
router.post("/", auth, createInvestment);
router.get("/:id", auth, getInvestmentById);
router.put("/:id", auth, updateInvestment);
router.delete("/:id", auth, deleteInvestment);

// Duplicate route
router.post("/:id/duplicate", auth, duplicateInvestment);

module.exports = router;
