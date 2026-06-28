const mongoose = require("mongoose");

const incomeSchema = new mongoose.Schema(
  {
    amount: Number,
    source: String,
    date: Date,
    notes: {
      type: String,
      required: false
    }
    ,
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Income", incomeSchema);
