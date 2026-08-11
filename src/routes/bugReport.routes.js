const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const bugReportRateLimiter = require("../middlewares/bugReportRateLimiter");
const { createBugReport, getBugReports, updateBugReportStatus } = require("../controllers/bugReport.controller");

router.post("/", auth, bugReportRateLimiter(), createBugReport);
router.get("/", auth, getBugReports);
router.patch("/:id", auth, updateBugReportStatus);

module.exports = router;
