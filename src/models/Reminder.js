const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    reminderType: {
      type: String,
      enum: ["push", "email", "sms", "all"],
      default: "push"
    },
    daysBefore: { type: Number, default: 1, min: 0 },
    reminderTime: { type: String, default: "08:00" },
    pushEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: false },
    smsEnabled: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

reminderSchema.index({ billId: 1, familyId: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);
