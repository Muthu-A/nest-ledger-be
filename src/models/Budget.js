const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    budgetAmount: {
      type: Number,
      required: true
    }
    ,
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Budget", budgetSchema);
