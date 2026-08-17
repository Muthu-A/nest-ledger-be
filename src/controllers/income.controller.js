const Income = require("../models/Income");
const Expense = require("../models/Expense");
const FamilyMember = require("../models/FamilyMember");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");
const { filterAllowedFields, getFamilyIdAndVerifyOwnership } = require("../utils/validation");

exports.getIncomes = async (req, res) => {
  try {
    const { monthRange } = req;
    
    const familyId = await getFamilyIdAndVerifyOwnership(req, FamilyMember);
    if (familyId === undefined) {
      return res.status(403).json({ message: "Family context required" });
    }
    
    const match = { familyId };
    if (monthRange && monthRange.startDate && monthRange.endDate) {
      match.date = { $gte: monthRange.startDate, $lte: monthRange.endDate };
    }
    const incomes = await Income.find(match).sort({ date: -1 }).populate("createdBy", "name").lean();

    // totalIncome = sum of all incomes in current month (from returned incomes)
    const currentMonthTotal = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
    const totalIncome = Math.round(currentMonthTotal * 100) / 100;

    const currentMonthExpenseAgg = await Expense.aggregate([
      { $match: { familyId, date: { $gte: monthRange.startDate, $lte: monthRange.endDate } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
      { $project: { _id: 0, total: 1 } }
    ]);
    const currentMonthExpense = currentMonthExpenseAgg.length ? currentMonthExpenseAgg[0].total : 0;
    const currentMonthSavings = Math.round((totalIncome - currentMonthExpense) * 100) / 100;

    // For yearly/monthly based stats, use current year (or monthRange.year if present)
    const yearForStats = monthRange && monthRange.year ? monthRange.year : new Date().getFullYear();
    const startOfYear = new Date(Date.UTC(yearForStats, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(yearForStats, 11, 31, 23, 59, 59, 999));

    const monthlyAgg = await Income.aggregate([
      { $match: { familyId, date: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { month: { $month: "$date" } }, total: { $sum: "$amount" } } },
      { $project: { _id: 0, month: "$_id.month", total: 1 } }
    ]);

    const monthlyTotals = new Array(12).fill(0);
    monthlyAgg.forEach((m) => {
      if (m.month >= 1 && m.month <= 12) monthlyTotals[m.month - 1] = m.total;
    });

    const yearlyTotal = Math.round(monthlyTotals.reduce((s, v) => s + v, 0) * 100) / 100;
    const averageIncome = Math.round((yearlyTotal / 12) * 100) / 100; // average per month across 12 months
    const highestIncome = Math.round(Math.max(...monthlyTotals) * 100) / 100; // highest monthly total

    // highestEntry = largest single income record in the returned set
    const highestEntry = incomes.reduce((max, inc) => Math.max(max, inc.amount || 0), 0);
    const incomeSourcesCount = new Set(incomes.map((inc) => inc.source)).size;

    res.json({
      incomes,
      stats: {
        totalIncome,
        averageIncome,
        highestIncome,
        highestEntry,
        incomeSourcesCount,
        currentMonthExpense: Math.round(currentMonthExpense * 100) / 100,
        currentMonthSavings
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch incomes" });
  }
};

exports.createIncome = async (req, res) => {
  try {
    const { amount, source, date, notes } = req.body;

    if (amount == null || !source || !date) {
      return res.status(400).json({
        message: "amount, source, and date are required"
      });
    }

    const payload = { amount, source, date: new Date(date), notes };
    if (req.user && req.user.familyId) payload.familyId = req.user.familyId;
    if (req.user && (req.user.id || req.user._id)) payload.createdBy = req.user.id || req.user._id;

    const createdIncome = await Income.create(payload);
    const income = await Income.findById(createdIncome._id).populate("createdBy", "name").lean();

    if (payload.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(payload.familyId, "income-created", { data: income, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "added", source, amount);
      socketService.emitToFamily(payload.familyId, "activity-created", { message: msg, meta: { type: "income", incomeId: createdIncome._id }, actor });
    }

    res.status(201).json(income);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create income" });
  }
};

exports.updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    
    const familyId = await getFamilyIdAndVerifyOwnership(req, FamilyMember);
    if (familyId === undefined) {
      return res.status(403).json({ message: "Family context required" });
    }

    // Only allow specific fields to be updated
    const allowedFields = ['amount', 'source', 'date', 'notes'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    });

    // Special handling for date field
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    // Verify ownership: the income must belong to the user's family
    const updatedIncome = await Income.findOneAndUpdate(
      { _id: id, familyId },
      updateData,
      { new: true }
    ).populate("createdBy", "name");

    if (!updatedIncome) {
      return res.status(404).json({ message: "Income not found" });
    }

    // emit
    if (familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(familyId, "income-updated", { data: updatedIncome, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "updated", updatedIncome.source, updatedIncome.amount);
      socketService.emitToFamily(familyId, "activity-created", { message: msg, meta: { type: "income", incomeId: updatedIncome._id }, actor });
    }

    res.json(updatedIncome);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update income" });
  }
};

exports.deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // allow null req.user.familyId (personal context)

    // Verify ownership: only delete income belonging to user's family
    const deletedIncome = await Income.findOneAndDelete({ _id: id, familyId: req.user.familyId });

    if (!deletedIncome) {
      return res.status(404).json({ message: "Income not found" });
    }

    // Get the month and year from the deleted income
    const incomeDate = new Date(deletedIncome.date);
    const month = incomeDate.getMonth() + 1;
    const year = incomeDate.getFullYear();

    // Check if there are any remaining incomes for that month in the same family
    const remainingIncomes = await Income.countDocuments({
      familyId: req.user.familyId,
      $expr: {
        $and: [
          { $eq: [{ $year: "$date" }, year] },
          { $eq: [{ $month: "$date" }, month] }
        ]
      }
    });

    // If no incomes remain for that month, delete all expenses for that month in the same family
    if (remainingIncomes === 0) {
      await Expense.deleteMany({
        familyId: req.user.familyId,
        $expr: {
          $and: [
            { $eq: [{ $year: "$date" }, year] },
            { $eq: [{ $month: "$date" }, month] }
          ]
        }
      });
    }

    const familyId = deletedIncome.familyId;
    if (familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(familyId, "income-deleted", { id: deletedIncome._id, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "deleted", deletedIncome.source, deletedIncome.amount);
      socketService.emitToFamily(familyId, "activity-created", { message: msg, meta: { type: "income", incomeId: deletedIncome._id }, actor });
    }

    res.json({ message: "Income deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete income" });
  }
};
