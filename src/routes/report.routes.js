const express = require("express");
const router = express.Router();
const {
  getReportSummary,
  getReportTrends,
  getReportCategoryBreakdown,
  getReportTopTransactions,
  getReportPivot
} = require("../controllers/report.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/summary", auth, getReportSummary);
router.get("/trends", auth, getReportTrends);
router.get("/category-breakdown", auth, getReportCategoryBreakdown);
router.get("/top-transactions", auth, getReportTopTransactions);
router.get("/pivot", auth, getReportPivot);

module.exports = router;
