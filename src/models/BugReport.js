const mongoose = require("mongoose");

const bugReportSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["bug", "feedback"],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, trim: true, default: null },
    userEmail: { type: String, trim: true, lowercase: true, default: null },
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", default: null, index: true },
    pageUrl: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "bug_reports",
  }
);

module.exports = mongoose.model("BugReport", bugReportSchema);
