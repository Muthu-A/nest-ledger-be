const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paidDate: { type: Date, required: true },
    paymentMethod: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ billId: 1, familyId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
