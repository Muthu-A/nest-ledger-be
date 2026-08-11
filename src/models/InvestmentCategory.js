const mongoose = require('mongoose');

const InvestmentCategorySchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

InvestmentCategorySchema.index({ familyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('InvestmentCategory', InvestmentCategorySchema);
