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
  getInvestmentHistory,
  getInvestmentHistoryById,
  deactivateCategory,
  activateCategory,
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
router.get("/history", auth, getInvestmentHistory);
router.get("/history/:id", auth, getInvestmentHistoryById);
router.post("/", auth, createInvestment);
router.get("/:id", auth, getInvestmentById);
router.put("/:id", auth, updateInvestment);
router.delete("/:id", auth, deleteInvestment);

// Duplicate route
router.post("/:id/duplicate", auth, duplicateInvestment);

// Category activation/deactivation
router.post("/categories/deactivate", auth, deactivateCategory);
router.post("/categories/activate", auth, activateCategory);

module.exports = router;
