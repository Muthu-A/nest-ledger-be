const Expense = require("../models/Expense");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");
const { getAllSubcategories } = require("../utils/expenseCategories");

exports.getExpenses = async (req, res) => {
  try {
    // Use monthRange provided by middleware; defaults to current month
    const { monthRange } = req;
    const match = {};
    // require auth: show only for user's family
    if (req.user && req.user.familyId) match.familyId = req.user.familyId;
    if (monthRange && monthRange.startDate && monthRange.endDate) {
      match.date = { $gte: monthRange.startDate, $lte: monthRange.endDate };
    }
    const expenses = await Expense.find(match).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { category, subCategory, amount, date, notes } = req.body;

    if (!category || amount == null || !date) {
      return res.status(400).json({
        message: "category, amount, and date are required"
      });
    }

    // Convert category to lowercase for consistency
    const categoryLowercase = category.toLowerCase();

    // Validate category
    const subcategories = getAllSubcategories();
    if (!subcategories[categoryLowercase]) {
      return res.status(400).json({
        message: `Invalid category: ${category}. Please use a valid expense subcategory.`,
        validCategories: Object.keys(subcategories)
      });
    }

    const payload = {
      category: categoryLowercase,
      subCategory,
      amount,
      date: new Date(date),
      notes
    };

    // attach familyId and createdBy when available
    if (req.user && req.user.familyId) payload.familyId = req.user.familyId;
    if (req.user && req.user.id) payload.createdBy = req.user.id;

    const expense = await Expense.create(payload);

    // Emit to family via socket service
    if (payload.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(payload.familyId, "expense-created", { data: expense, actor });
      // activity message
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "added", categoryLowercase, amount);
      socketService.emitToFamily(payload.familyId, "activity-created", { message: msg, meta: { type: "expense", expenseId: expense._id }, actor });
    }

    res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create expense" });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const expense = await Expense.findByIdAndUpdate(id, updates, { new: true });
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    // emit
    const familyId = (req.user && req.user.familyId) || expense.familyId;
    if (familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(familyId, "expense-updated", { data: expense, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "updated", expense.category || "expense", expense.amount);
      socketService.emitToFamily(familyId, "activity-created", { message: msg, meta: { type: "expense", expenseId: expense._id }, actor });
    }

    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update expense" });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const familyId = (req.user && req.user.familyId) || expense.familyId;
    if (familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(familyId, "expense-deleted", { id: expense._id, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "deleted", expense.category || "expense", expense.amount);
      socketService.emitToFamily(familyId, "activity-created", { message: msg, meta: { type: "expense", expenseId: expense._id }, actor });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete expense" });
  }
};
