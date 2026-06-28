const express = require("express");
const router = express.Router();
const {
  getReportSummary,
  getReportTrends,
  getReportCategoryBreakdown,
  getReportTopTransactions,
  getReportPivot
} = require("../controllers/report.controller");

router.get("/summary", getReportSummary);
router.get("/trends", getReportTrends);
router.get("/category-breakdown", getReportCategoryBreakdown);
router.get("/top-transactions", getReportTopTransactions);
router.get("/pivot", getReportPivot);

module.exports = router;
