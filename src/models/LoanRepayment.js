const mongoose = require("mongoose");

const loanRepaymentSchema = new mongoose.Schema(
  {
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true, index: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "loan_repayments",
  }
);

module.exports = mongoose.model("LoanRepayment", loanRepaymentSchema);
