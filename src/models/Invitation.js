const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    invitationCode: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// TTL index to auto-delete expired invitations (expiresAt must be a date)
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Invitation", invitationSchema);
