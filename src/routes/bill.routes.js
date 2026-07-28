const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  markPaidBill,
  skipBill,
  duplicateBill,
  getBillDashboard,
  getBillCalendar,
  getBillSummary
} = require("../controllers/bill.controller");

router.get("/dashboard", auth, getBillDashboard);
router.get("/calendar", auth, getBillCalendar);
router.get("/summary", auth, getBillSummary);
router.get("/:id", auth, getBillById);
router.get("/", auth, getBills);
router.post("/", auth, createBill);
router.patch("/:id", auth, updateBill);
router.delete("/:id", auth, deleteBill);
router.patch("/:id/mark-paid", auth, markPaidBill);
router.patch("/:id/skip", auth, skipBill);
router.patch("/:id/duplicate", auth, duplicateBill);

module.exports = router;
