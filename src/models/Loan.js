const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", default: null, index: true },
    type: { type: String, enum: ["lent", "borrowed"], required: true, index: true },
    personName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    amountSettled: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "partial", "settled"], default: "pending", index: true },
    isOpen: { type: Boolean, default: true, index: true },
    dueDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    collection: "loans",
  }
);

module.exports = mongoose.model("Loan", loanSchema);
