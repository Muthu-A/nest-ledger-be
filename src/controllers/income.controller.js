const Income = require("../models/Income");
const Expense = require("../models/Expense");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");

exports.getIncomes = async (req, res) => {
  try {
    const { monthRange } = req;
    const match = {};
    if (monthRange && monthRange.startDate && monthRange.endDate) {
      match.date = { $gte: monthRange.startDate, $lte: monthRange.endDate };
    }
    const incomes = await Income.find(match).sort({ date: -1 });
    res.json(incomes);
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
    if (req.user && req.user.id) payload.createdBy = req.user.id;

    const income = await Income.create(payload);

    if (payload.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(payload.familyId, "income-created", { data: income, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "added", source, amount);
      socketService.emitToFamily(payload.familyId, "activity-created", { message: msg, meta: { type: "income", incomeId: income._id }, actor });
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
    const updatedIncome = await Income.findByIdAndUpdate(id, req.body, {
      new: true
    });

    if (!updatedIncome) {
      return res.status(404).json({ message: "Income not found" });
    }

    // emit
    const familyId = (req.user && req.user.familyId) || updatedIncome.familyId;
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
    const deletedIncome = await Income.findByIdAndDelete(id);

    if (!deletedIncome) {
      return res.status(404).json({ message: "Income not found" });
    }

    // Get the month and year from the deleted income
    const incomeDate = new Date(deletedIncome.date);
    const month = incomeDate.getMonth() + 1;
    const year = incomeDate.getFullYear();

    // Check if there are any remaining incomes for that month
    const remainingIncomes = await Income.countDocuments({
      $expr: {
        $and: [
          { $eq: [{ $year: "$date" }, year] },
          { $eq: [{ $month: "$date" }, month] }
        ]
      }
    });

    // If no incomes remain for that month, delete all expenses for that month
    if (remainingIncomes === 0) {
      await Expense.deleteMany({
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
