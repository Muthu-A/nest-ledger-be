const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  createLoan,
  getLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
  addLoanRepayment,
  getLoanSummary,
  closeLoan,
  getLoanRepayments,
} = require("../controllers/loan.controller");

router.post("/", auth, createLoan);
router.get("/summary", auth, getLoanSummary);
router.get("/", auth, getLoans);
router.get("/:id", auth, getLoanById);
router.get("/:id/repayments", auth, getLoanRepayments);
router.patch("/:id", auth, updateLoan);
router.patch("/:id/close", auth, closeLoan);
router.delete("/:id", auth, deleteLoan);
router.post("/:id/repayments", auth, addLoanRepayment);

module.exports = router;
