const Income = require("../models/Income");
const Expense = require("../models/Expense");
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

    const monthKeys = monthRange
      ? new Set([monthRange.monthKey])
      : new Set([...monthlyIncomeMap.keys(), ...monthlyExpensesMap.keys()]);

    const monthlySummary = Array.from(monthKeys)
      .sort()
      .map((key) => {
        const [year, monthString] = key.split("-");
        const monthIndex = Number(monthString) - 1;
        const income = monthlyIncomeMap.get(key) || 0;
        const expense = monthlyExpensesMap.get(key) || 0;
        const balance = income - expense;

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

        return {
          month: `${MONTH_LABELS[monthIndex]} ${year}`,
          income,
          expense,
          savings: balance,
          balance,
          breakdown
        };
      });

    res.json({ monthlySummary });
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

    const agg = await Expense.aggregate([
      { $match: { date: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { month: { $month: "$date" } }, total: { $sum: "$amount" } } },
      { $project: { _id: 0, month: "$_id.month", total: 1 } }
    ]);

    // Prepare array for all 12 months (ensure months with 0 are present)
    const totals = new Array(12).fill(0);
    agg.forEach((item) => {
      if (item.month >= 1 && item.month <= 12) totals[item.month - 1] = item.total;
    });

    const monthlyExpenses = totals.map((amount, idx) => ({ month: MONTH_LABELS[idx], amount }));

    res.json({ year, monthlyExpenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch monthly expenses" });
  }
};
