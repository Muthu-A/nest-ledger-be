const mongoose = require("mongoose");

const familyMemberSchema = new mongoose.Schema(
  {
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "editor", "viewer"], default: "viewer" },
    joinedAt: { type: Date, default: Date.now },
    invitedAt: Date
  },
  { timestamps: true }
);

familyMemberSchema.index({ familyId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("FamilyMember", familyMemberSchema);
