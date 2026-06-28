const mongoose = require("mongoose");

const familySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

familySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model("Family", familySchema);
