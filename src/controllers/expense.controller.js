const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");
const { getAllSubcategories } = require("../utils/expenseCategories");

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

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
    const expenses = await Expense.find(match)
      .sort({ date: -1 })
      .populate("createdBy", "name")
      .lean();

    const expensesWithCreator = expenses.map((expense) => ({
      ...expense,
      createdByName: expense.createdBy?.name || null
    }));

    res.json(expensesWithCreator);
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
    
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // allow null req.user.familyId (personal context)

    // Only allow specific fields to be updated
    const allowedFields = ['category', 'subCategory', 'amount', 'date', 'notes'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    });

    // Special handling for date field
    if (updates.date) {
      updates.date = new Date(updates.date);
    }

    // Verify ownership: expense must belong to user's family
    const expense = await Expense.findOneAndUpdate(
      { _id: id, familyId: req.user.familyId },
      updates,
      { new: true }
    );
    
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    // emit
    const familyId = req.user.familyId;
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
    
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // allow null req.user.familyId (personal context)

    // Verify ownership: expense must belong to user's family
    const expense = await Expense.findOneAndDelete({ _id: id, familyId: req.user.familyId });
    
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const familyId = req.user.familyId;
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

// Expense Dashboard: Returns aggregated expense analytics for the selected month
exports.getExpenseDashboard = async (req, res) => {
  try {
    const { monthRange } = req;
    if (!monthRange) {
      return res.status(400).json({
        success: false,
        message: "Month parameter is required"
      });
    }

    const familyId = req.user?.familyId;
    if (familyId === undefined) {
      return res.status(403).json({
        success: false,
        message: "Family ID is required"
      });
    }

    // familyMatch is either an ObjectId (for family) or null (personal context)
    const familyMatch = familyId ? new mongoose.Types.ObjectId(familyId) : null;

    const { year, month, monthKey, startDate, endDate } = monthRange;

    // Get previous month's start and end dates
    const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
    const prevMonthStart = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth(), 1));
    const prevMonthEnd = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Get last 3 months for average calculation (including current month)
    const threeMonthsAgoDate = new Date(Date.UTC(year, month - 3, 1));
    const threeMonthsStart = new Date(Date.UTC(threeMonthsAgoDate.getUTCFullYear(), threeMonthsAgoDate.getUTCMonth(), 1));

    // Get current month expenses
    const currentMonthExpenses = await Expense.aggregate([
      {
        $match: {
          familyId: familyMatch,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          maxExpense: { $max: "$amount" }
        }
      }
    ]);

    const currentTotal = currentMonthExpenses[0]?.total || 0;
    const currentCount = currentMonthExpenses[0]?.count || 0;

    // Get previous month expenses
    const prevMonthExpenses = await Expense.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
          date: { $gte: prevMonthStart, $lte: prevMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const prevTotal = prevMonthExpenses[0]?.total || 0;

    // Calculate percentage change month-over-month
    const expenseChangePercentage = prevTotal === 0 
      ? (currentTotal === 0 ? 0 : 100)
      : Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10;

    // Get last 3 months expenses for average calculation
    const threeMonthsExpenses = await Expense.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
          date: { $gte: threeMonthsStart, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const threeMonthsTotals = threeMonthsExpenses.map(item => item.total);
    const averageMonthlyExpense = threeMonthsTotals.length > 0 
      ? Math.round((threeMonthsTotals.reduce((a, b) => a + b, 0) / threeMonthsTotals.length) * 100) / 100
      : 0;

    // Get previous 3-month average (6 months back to 3 months back)
    const sixMonthsAgoDate = new Date(Date.UTC(year, month - 6, 1));
    const sixMonthsStart = new Date(Date.UTC(sixMonthsAgoDate.getUTCFullYear(), sixMonthsAgoDate.getUTCMonth(), 1));
    const threeMonthsBeforeStart = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() - 2, 1));

    const prevThreeMonthsExpenses = await Expense.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
          date: { $gte: threeMonthsBeforeStart, $lte: prevMonthEnd }
        }
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const prevThreeMonthsTotals = prevThreeMonthsExpenses.map(item => item.total);
    const prevThreeMonthsAverage = prevThreeMonthsTotals.length > 0 
      ? prevThreeMonthsTotals.reduce((a, b) => a + b, 0) / prevThreeMonthsTotals.length
      : 0;

    const averageChangePercentage = prevThreeMonthsAverage === 0 
      ? (averageMonthlyExpense === 0 ? 0 : 100)
      : Math.round(((averageMonthlyExpense - prevThreeMonthsAverage) / prevThreeMonthsAverage) * 1000) / 10;

    // Get highest expense
    const highestExpenseDoc = await Expense.findOne({
      familyId: new mongoose.Types.ObjectId(familyId),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ amount: -1 }).lean();

    const highestExpense = highestExpenseDoc ? {
      amount: highestExpenseDoc.amount,
      category: highestExpenseDoc.category || "Unknown",
      date: highestExpenseDoc.date
    } : {
      amount: 0,
      category: "N/A",
      date: null
    };

    // Get all 12 months for the selected year
    const yearStartDate = new Date(Date.UTC(year, 0, 1));
    const yearEndDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const yearExpenses = await Expense.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
          date: { $gte: yearStartDate, $lte: yearEndDate }
        }
      },
      {
        $group: {
          _id: { month: { $month: "$date" } },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]);

    const monthlyTrendMap = new Map();
    yearExpenses.forEach((item) => {
      monthlyTrendMap.set(item._id.month, {
        expense: item.total || 0,
        transactions: item.count || 0
      });
    });

    const monthlyTrend = MONTH_LABELS.map((label, idx) => {
      const trendData = monthlyTrendMap.get(idx + 1) || { expense: 0, transactions: 0 };
      return {
        month: label,
        expense: trendData.expense,
        transactions: trendData.transactions
      };
    });

    // Get category breakdown for current month
    const categoryBreakdown = await Expense.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    const categoryBreakdownData = categoryBreakdown.map(item => ({
      category: item._id || "Uncategorized",
      amount: item.amount || 0,
      percentage: currentTotal > 0 ? Math.round((item.amount / currentTotal) * 100 * 100) / 100 : 0
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalExpenses: currentTotal,
          expenseChangePercentage,
          averageMonthlyExpense,
          averageChangePercentage,
          highestExpense,
          totalTransactions: currentCount
        },
        monthlyTrend,
        categoryBreakdown: categoryBreakdownData
      }
    });
  } catch (error) {
    console.error("Error in getExpenseDashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expense dashboard"
    });
  }
};
