const mongoose = require("mongoose");

const InvestmentCategoryEnum = [
  "Gold",
  "MutualFund",
  "SIP",
  "Stocks",
  "FD",
  "RD",
  "PPF",
  "EPF",
  "Crypto",
  "RealEstate",
  "EmergencyFund",
  "Others"
];

const FrequencyEnum = [
  "OneTime",
  "Monthly",
  "Quarterly",
  "HalfYearly",
  "Yearly"
];

const StatusEnum = [
  "ACTIVE",
  "CLOSED",
  "PAUSED"
];

const investmentSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    investmentName: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: InvestmentCategoryEnum,
      required: true
    },
    amountInvested: {
      type: Number,
      required: true,
      min: 0
    },
    currentValue: {
      type: Number,
      required: true,
      min: 0
    },
    platform: {
      type: String,
      trim: true
    },
    frequency: {
      type: String,
      enum: FrequencyEnum,
      required: true
    },
    purchaseDate: {
      type: Date,
      required: true
    },
    reminderEnabled: {
      type: Boolean,
      default: false
    },
    reminderDate: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: StatusEnum,
      default: "ACTIVE"
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
investmentSchema.index({ familyId: 1, isDeleted: 1 });
investmentSchema.index({ userId: 1, isDeleted: 1 });
investmentSchema.index({ familyId: 1, category: 1, isDeleted: 1 });
investmentSchema.index({ reminderDate: 1, reminderEnabled: 1, status: 1 });

module.exports = mongoose.model("Investment", investmentSchema);
