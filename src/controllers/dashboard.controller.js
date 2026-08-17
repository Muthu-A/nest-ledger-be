const Income = require("../models/Income");
const Expense = require("../models/Expense");
const Loan = require("../models/Loan");
const { EXPENSE_CATEGORIES, getCategoryInfo } = require("../utils/expenseCategories");

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

const toMonthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

exports.getDashboardSummary = async (req, res) => {
  try {
    const { monthRange } = req;
    const incomeData = await Income.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    const expenseData = await Expense.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            category: "$category"
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    const monthlyIncomeMap = new Map();
    incomeData.forEach((item) => {
      const key = toMonthKey(item._id.year, item._id.month);
      monthlyIncomeMap.set(key, item.total);
    });

    const monthlyExpensesMap = new Map();
    const monthlySubcategoryMap = new Map();

    expenseData.forEach((item) => {
      const key = toMonthKey(item._id.year, item._id.month);
      monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) || 0) + item.total);

      // Get subcategory from the category info
      const categoryInfo = getCategoryInfo(item._id.category || "Other");
      const subcategory = categoryInfo.subCategory;
      
      const subcategoryList = monthlySubcategoryMap.get(key) || [];
      const existingItem = subcategoryList.find(c => c.label === subcategory);
      
      if (existingItem) {
        existingItem.amount += item.total;
      } else {
        subcategoryList.push({ label: subcategory, amount: item.total });
      }
      monthlySubcategoryMap.set(key, subcategoryList);
    });

    const loanTotals = await Loan.aggregate([
      {
        $project: {
          type: 1,
          amount: 1,
          amountSettled: 1,
          remaining: { $subtract: ["$amount", { $ifNull: ["$amountSettled", 0] }] }
        }
      },
      {
        $group: {
          _id: null,
          pendingLent: {
            $sum: {
              $cond: [
                { $eq: ["$type", "lent"] },
                { $max: ["$remaining", 0] },
                0
              ]
            }
          },
          pendingBorrowed: {
            $sum: {
              $cond: [
                { $eq: ["$type", "borrowed"] },
                { $max: ["$remaining", 0] },
                0
              ]
            }
          }
        }
      }
    ]);

    const pendingLent = loanTotals[0]?.pendingLent || 0;
    const pendingBorrowed = loanTotals[0]?.pendingBorrowed || 0;
    const loanAdjustment = pendingBorrowed - pendingLent;

    const getPreviousMonthKey = (year, month) => {
      const date = new Date(Date.UTC(year, month - 1, 1));
      date.setUTCMonth(date.getUTCMonth() - 1);
      return toMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
    };

    const getPercentChange = (previous, current) => {
      if (previous === 0) {
        return current === 0 ? 0 : 100;
      }
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    const monthKeys = monthRange
      ? new Set([monthRange.monthKey])
      : new Set([...monthlyIncomeMap.keys(), ...monthlyExpensesMap.keys()]);

    const monthlySummary = Array.from(monthKeys)
      .sort()
      .map((key) => {
        const [year, monthString] = key.split("-");
        const income = monthlyIncomeMap.get(key) || 0;
        const expense = monthlyExpensesMap.get(key) || 0;
        const balance = income - expense + loanAdjustment;

        const prevKey = getPreviousMonthKey(Number(year), Number(monthString));
        const previousIncome = monthlyIncomeMap.get(prevKey) || 0;
        const previousExpense = monthlyExpensesMap.get(prevKey) || 0;
        const previousSavings = previousIncome - previousExpense;
        const previousBalance = previousSavings + loanAdjustment;

        const categories = (monthlySubcategoryMap.get(key) || [])
          .filter((item) => item.amount > 0)
          .sort((a, b) => b.amount - a.amount);

        const totalCategoryAmount = categories.reduce((sum, item) => sum + item.amount, 0);

        const breakdown = totalCategoryAmount > 0
          ? categories.map((item) => ({
              label: item.label,
              amount: item.amount,
              percent: Math.round((item.amount / totalCategoryAmount) * 100),
              color: "#38bdf8"
            }))
          : [];

        const incomeDiff = income - previousIncome;
        const expenseDiff = expense - previousExpense;
        const savingsDiff = balance - previousSavings;
        const balanceDiff = balance - previousBalance;

        return {
          month: key,
          income,
          expense,
          savings: balance,
          balance,
          loanAdjustment,
          breakdown,
          previousMonth: {
            income: previousIncome,
            expense: previousExpense,
            savings: previousSavings,
            balance: previousBalance
          },
          diffs: {
            incomeDiff,
            expenseDiff,
            savingsDiff,
            balanceDiff
          },
          changes: {
              income: getPercentChange(previousIncome, income),
              expense: getPercentChange(previousExpense, expense),
              savings: getPercentChange(previousSavings, balance),
              balance: getPercentChange(previousBalance, balance)
            }
        };
      });

      // Build monthlyExpenses array for the requested year (or current year)
      const yearForMonthly = monthRange ? monthRange.year : new Date().getFullYear();
      const monthlyExpenses = MONTH_LABELS.map((label, idx) => {
        const key = toMonthKey(yearForMonthly, idx + 1);
        return {
          month: label,
          expenses: monthlyExpensesMap.get(key) || 0,
          income: monthlyIncomeMap.get(key) || 0
        };
      });

      res.json({ monthlySummary, monthlyExpenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch dashboard summary" });
  }
};

exports.getRecentTransactions = async (req, res) => {
  try {
    // Determine if client explicitly passed a `month` query parameter.
    const monthProvided = (req.originalUrl || req.url || "").includes("month=");

    const filter = {};
    if (monthProvided && req.monthRange) {
      filter.date = { $gte: req.monthRange.startDate, $lte: req.monthRange.endDate };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 }).limit(10).lean();

    const recentTransactions = expenses.map((item) => ({
      id: item._id,
      title: item.category || "Expense",
      description: item.subCategory || item.notes || "Expense transaction",
      amount: item.amount,
      type: "expense",
      date: item.date
    }));

    res.json({ recentTransactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch recent transactions" });
  }
};

// Returns monthly expense totals for a given year (default: current year).
// If client supplies `?year=YYYY` the API returns data for that year.
exports.getMonthlyExpenses = async (req, res) => {
  try {
    const yearParam = req.query.year;
    let year;

    if (yearParam && /^\d{4}$/.test(yearParam)) {
      year = parseInt(yearParam, 10);
    } else {
      year = new Date().getFullYear();
    }

    // Build UTC start/end for the year
    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const expenseAgg = await Expense.aggregate([
      { $match: { date: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { month: { $month: "$date" } }, total: { $sum: "$amount" } } },
      { $project: { _id: 0, month: "$_id.month", total: 1 } }
    ]);

    const incomeAgg = await Income.aggregate([
      { $match: { date: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { month: { $month: "$date" } }, total: { $sum: "$amount" } } },
      { $project: { _id: 0, month: "$_id.month", total: 1 } }
    ]);

    const expenseTotals = new Array(12).fill(0);
    expenseAgg.forEach((item) => {
      if (item.month >= 1 && item.month <= 12) expenseTotals[item.month - 1] = item.total;
    });

    const incomeTotals = new Array(12).fill(0);
    incomeAgg.forEach((item) => {
      if (item.month >= 1 && item.month <= 12) incomeTotals[item.month - 1] = item.total;
    });

    const monthlyExpenses = MONTH_LABELS.map((month, idx) => {
      const expense = expenseTotals[idx] || 0;
      const income = incomeTotals[idx] || 0;
      return {
        month,
        expenses: expense,
        income,
        savings: income - expense
      };
    });

    res.json({ year, monthlyExpenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch monthly expenses" });
  }
};
