const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    isRecurring: { type: Boolean, default: false },
    frequency: { type: String, trim: true, lowercase: true },
    autoPay: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["upcoming", "paid", "overdue", "skipped"],
      default: "upcoming"
    },
    notes: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

billSchema.index({ familyId: 1, dueDate: 1 });

module.exports = mongoose.model("Bill", billSchema);
