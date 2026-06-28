const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const Income = require("../models/Income");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");
const {
  BUDGET_CATEGORIES,
  getExpenseCategoriesForBudget,
  normalizeCategoryName
} = require("../utils/budgetCategories");

// Create Budget
exports.createBudget = async (req, res) => {
  try {
    const { month, category, budgetAmount } = req.body;

    if (!month || !category || !budgetAmount) {
      return res.status(400).json({
        success: false,
        message: "month, category, and budgetAmount are required"
      });
    }

    // Validate category
    if (!BUDGET_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Allowed categories: ${BUDGET_CATEGORIES.join(", ")}`
      });
    }

    // Check if budget already exists for this month and category
    const existingBudget = await Budget.findOne({ month, category });
    if (existingBudget) {
      return res.status(400).json({
        success: false,
        message: "Budget already exists for this month and category"
      });
    }

    const payload = { month, category, budgetAmount };
    if (req.user && req.user.familyId) payload.familyId = req.user.familyId;
    if (req.user && req.user.id) payload.createdBy = req.user.id;
    const budget = await Budget.create(payload);

    if (payload.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(payload.familyId, "budget-created", { data: budget, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "created budget for", category);
      socketService.emitToFamily(payload.familyId, "activity-created", { message: msg, meta: { type: "budget", budgetId: budget._id }, actor });
    }

    res.status(201).json({
      success: true,
      message: "Budget created successfully",
      data: {
        budgetId: budget._id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create budget"
    });
  }
};

// Update Budget
exports.updateBudget = async (req, res) => {
  try {
    const { budgetId } = req.params;
    const { budgetAmount } = req.body;

    if (!budgetAmount) {
      return res.status(400).json({
        success: false,
        message: "budgetAmount is required"
      });
    }

    const budget = await Budget.findByIdAndUpdate(
      budgetId,
      { budgetAmount },
      { new: true }
    );

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found"
      });
    }

    // emit
    const familyId = (req.user && req.user.familyId) || budget.familyId;
    if (familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(familyId, "budget-updated", { data: budget, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "updated budget for", budget.category, budget.budgetAmount);
      socketService.emitToFamily(familyId, "activity-created", { message: msg, meta: { type: "budget", budgetId: budget._id }, actor });
    }

    res.json({
      success: true,
      message: "Budget updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update budget"
    });
  }
};

// Delete Budget
exports.deleteBudget = async (req, res) => {
  try {
    const { budgetId } = req.params;

    const budget = await Budget.findByIdAndDelete(budgetId);

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found"
      });
    }

    const familyId = budget.familyId;
    if (familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(familyId, "budget-deleted", { id: budget._id, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "deleted budget for", budget.category);
      socketService.emitToFamily(familyId, "activity-created", { message: msg, meta: { type: "budget", budgetId: budget._id }, actor });
    }

    res.json({
      success: true,
      message: "Budget deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete budget"
    });
  }
};

// Get Budget List with spending details
exports.getBudgetList = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "month query parameter is required"
      });
    }

    const budgets = await Budget.find({ month });

    // Parse month to get year and month number
    const [year, monthNum] = month.split("-");

    // Get expenses for this month
    const expenses = await Expense.find();
    const monthExpenses = expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      const expYear = expDate.getFullYear();
      const expMonth = String(expDate.getMonth() + 1).padStart(2, "0");
      return expYear === parseInt(year) && expMonth === monthNum;
    });

    // Create map of expenses by category with flexible matching
    const expensesByCategory = {};
    monthExpenses.forEach((exp) => {
      // Find which budget category this expense belongs to
      for (const budgetCat of BUDGET_CATEGORIES) {
        const relatedExpenseCategories = getExpenseCategoriesForBudget(budgetCat);
        const expCategory = normalizeCategoryName(exp.category);
        
        if (
          relatedExpenseCategories.some(
            (cat) => normalizeCategoryName(cat) === expCategory
          ) ||
          normalizeCategoryName(budgetCat) === expCategory
        ) {
          expensesByCategory[budgetCat] =
            (expensesByCategory[budgetCat] || 0) + exp.amount;
          break;
        }
      }
    });

    // Format response with spending details
    const budgetList = budgets.map((budget) => {
      const spent = expensesByCategory[budget.category] || 0;
      const remaining = budget.budgetAmount - spent;
      const progress = Math.round((spent / budget.budgetAmount) * 100);

      return {
        budgetId: budget._id,
        category: budget.category,
        budget: budget.budgetAmount,
        spent,
        remaining,
        progress
      };
    });

    res.json({
      success: true,
      data: budgetList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch budget list"
    });
  }
};

// Get Budget Summary
exports.getBudgetSummary = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "month query parameter is required"
      });
    }

    // Parse month
    const [year, monthNum] = month.split("-");

    // Get all budgets for this month
    const budgets = await Budget.find({ month });

    // Get all incomes for this month
    const incomes = await Income.find();
    const monthIncomes = incomes.filter((inc) => {
      const incDate = new Date(inc.date);
      const incYear = incDate.getFullYear();
      const incMonth = String(incDate.getMonth() + 1).padStart(2, "0");
      return incYear === parseInt(year) && incMonth === monthNum;
    });

    // Get all expenses for this month
    const expenses = await Expense.find();
    const monthExpenses = expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      const expYear = expDate.getFullYear();
      const expMonth = String(expDate.getMonth() + 1).padStart(2, "0");
      return expYear === parseInt(year) && expMonth === monthNum;
    });

    // Calculate totals
    const monthlyIncome = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalBudget = budgets.reduce((sum, bud) => sum + bud.budgetAmount, 0);
    const totalSpent = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remainingBudget = totalBudget - totalSpent;
    const budgetUtilizationPercentage =
      totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100 * 100) / 100 : 0;

    res.json({
      success: true,
      data: {
        monthlyIncome,
        totalBudget,
        totalSpent,
        remainingBudget,
        budgetUtilizationPercentage
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch budget summary"
    });
  }
};
