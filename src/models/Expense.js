const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    category: String,
    subCategory: String,
    amount: Number,
    date: Date,
    notes: String,
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Expense", expenseSchema);
