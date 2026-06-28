const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
  {
    goalName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    targetAmount: {
      type: Number,
      required: true
    },
    currentAmount: {
      type: Number,
      default: 0
    },
    targetDate: {
      type: Date,
      required: true
    },
    notes: {
      type: String,
      required: false
    },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "ARCHIVED"],
      default: "ACTIVE"
    }
    ,
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Goal", goalSchema);
