const Income = require("../models/Income");
const Expense = require("../models/Expense");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 1000;
const MONTH_FORMAT = "%Y-%m";
const DAY_FORMAT = "%Y-%m-%d";
const COLOR_PALETTE = ["#38bdf8", "#f97316", "#a855f7", "#22c55e", "#e11d48", "#0ea5e9", "#f59e0b"];

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateRange = (start, end) => {
  if (!start || !end) return null;
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  if (startDate > endDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const buildDateBuckets = (startDate, endDate, interval) => {
  const buckets = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    if (interval === "month") {
      buckets.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`);
      current.setUTCMonth(current.getUTCMonth() + 1);
      current.setUTCDate(1);
      current.setUTCHours(0, 0, 0, 0);
    } else {
      buckets.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}-${String(current.getUTCDate()).padStart(2, "0")}`);
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
    }
  }

  return buckets;
};

const getGroupFormat = (interval) => {
  if (interval === "month") return MONTH_FORMAT;
  return DAY_FORMAT;
};

const buildGroupedSummary = (incomeMap, expenseMap, groupKeyName) => {
  const keys = new Set([...incomeMap.keys(), ...expenseMap.keys()]);
  return Array.from(keys)
    .sort()
    .map((key) => {
      const income = incomeMap.get(key) || 0;
      const expense = expenseMap.get(key) || 0;
      const savings = income - expense;
      if (groupKeyName === "category") {
        return { category: key || "Uncategorized", income, expense, savings };
      }
      return { date: key, income, expense, savings };
    });
};

const getReportSummary = async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    const range = normalizeDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ error: "Invalid or missing startDate/endDate" });
    }

    const match = { date: { $gte: range.startDate, $lte: range.endDate } };

    const [incomeTotalResult, expenseTotalResult] = await Promise.all([
      Income.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }])
    ]);

    const totalIncome = incomeTotalResult[0]?.total || 0;
    const totalExpense = expenseTotalResult[0]?.total || 0;
    const balance = totalIncome - totalExpense;

    const response = {
      totalIncome,
      totalExpense,
      totalSavings: balance,
      balance,
      period: {
        start: range.startDate.toISOString(),
        end: range.endDate.toISOString()
      }
    };

    if (groupBy) {
      const normalizedGroupBy = groupBy.toLowerCase();
      if (!["day", "month", "category"].includes(normalizedGroupBy)) {
        return res.status(400).json({ error: "Invalid groupBy value" });
      }

      if (normalizedGroupBy === "category") {
        const [incomeGroups, expenseGroups] = await Promise.all([
          Income.aggregate([
            { $match: match },
            { $group: { _id: { $ifNull: ["$source", "Income"] }, total: { $sum: "$amount" } } }
          ]),
          Expense.aggregate([
            { $match: match },
            { $group: { _id: { $ifNull: ["$category", "Uncategorized"] }, total: { $sum: "$amount" } } }
          ])
        ]);

        const incomeMap = new Map(incomeGroups.map((item) => [item._id, item.total]));
        const expenseMap = new Map(expenseGroups.map((item) => [item._id, item.total]));
        response.breakdown = buildGroupedSummary(incomeMap, expenseMap, "category");
      } else {
        const format = getGroupFormat(normalizedGroupBy);
        const [incomeGroups, expenseGroups] = await Promise.all([
          Income.aggregate([
            { $match: match },
            {
              $group: {
                _id: { $dateToString: { format, date: "$date" } },
                total: { $sum: "$amount" }
              }
            }
          ]),
          Expense.aggregate([
            { $match: match },
            {
              $group: {
                _id: { $dateToString: { format, date: "$date" } },
                total: { $sum: "$amount" }
              }
            }
          ])
        ]);

        const incomeMap = new Map(incomeGroups.map((item) => [item._id, item.total]));
        const expenseMap = new Map(expenseGroups.map((item) => [item._id, item.total]));
        response.breakdown = buildGroupedSummary(incomeMap, expenseMap, "date");
      }
    }

    return res.json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch report summary", details: error.message });
  }
};

const getReportTrends = async (req, res) => {
  try {
    const { startDate, endDate, interval = "day" } = req.query;
    const range = normalizeDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ error: "Invalid or missing startDate/endDate" });
    }

    const normalizedInterval = interval === "month" ? "month" : "day";
    const format = getGroupFormat(normalizedInterval);

    const match = { date: { $gte: range.startDate, $lte: range.endDate } };

    const [incomeGroups, expenseGroups] = await Promise.all([
      Income.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: "$date" } },
            total: { $sum: "$amount" }
          }
        }
      ]),
      Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: "$date" } },
            total: { $sum: "$amount" }
          }
        }
      ])
    ]);

    const incomeMap = new Map(incomeGroups.map((item) => [item._id, item.total]));
    const expenseMap = new Map(expenseGroups.map((item) => [item._id, item.total]));
    const buckets = buildDateBuckets(range.startDate, range.endDate, normalizedInterval);

    const data = buckets.map((key) => {
      const income = incomeMap.get(key) || 0;
      const expense = expenseMap.get(key) || 0;
      return {
        date: key,
        income,
        expense,
        savings: income - expense
      };
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch report trends", details: error.message });
  }
};

const getReportCategoryBreakdown = async (req, res) => {
  try {
    const { startDate, endDate, type = "expense" } = req.query;
    const range = normalizeDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ error: "Invalid or missing startDate/endDate" });
    }

    const normalizedType = type.toLowerCase();
    if (!["expense", "income", "both"].includes(normalizedType)) {
      return res.status(400).json({ error: "Invalid type value" });
    }

    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);

    const match = { date: { $gte: range.startDate, $lte: range.endDate } };
    const breakdownMap = new Map();
    let grandTotal = 0;

    if (normalizedType !== "income") {
      const expenseGroups = await Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ["$category", "Uncategorized"] },
            total: { $sum: "$amount" }
          }
        }
      ]);
      expenseGroups.forEach((item) => {
        const category = item._id || "Uncategorized";
        breakdownMap.set(category, (breakdownMap.get(category) || 0) + item.total);
        grandTotal += item.total;
      });
    }

    if (normalizedType !== "expense") {
      const incomeGroups = await Income.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ["$source", "Income"] },
            total: { $sum: "$amount" }
          }
        }
      ]);
      incomeGroups.forEach((item) => {
        const category = item._id || "Income";
        breakdownMap.set(category, (breakdownMap.get(category) || 0) + item.total);
        grandTotal += item.total;
      });
    }

    const breakdown = Array.from(breakdownMap.entries())
      .map(([category, amount], index) => ({
        category,
        amount,
        percent: grandTotal > 0 ? Number(((amount / grandTotal) * 100).toFixed(2)) : 0,
        color: COLOR_PALETTE[index % COLOR_PALETTE.length]
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = breakdown.length;
    const pagedBreakdown = breakdown.slice((page - 1) * limit, page * limit);

    return res.json({ breakdown: pagedBreakdown, page, limit, total });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch category breakdown", details: error.message });
  }
};

const getReportTopTransactions = async (req, res) => {
  try {
    const { startDate, endDate, type = "both" } = req.query;
    const range = normalizeDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ error: "Invalid or missing startDate/endDate" });
    }

    const normalizedType = type.toLowerCase();
    if (!["expense", "income", "both"].includes(normalizedType)) {
      return res.status(400).json({ error: "Invalid type value" });
    }

    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);

    const match = { date: { $gte: range.startDate, $lte: range.endDate } };
    const transactions = [];

    if (normalizedType !== "income") {
      const expenses = await Expense.find(match).lean();
      expenses.forEach((item) => {
        transactions.push({
          id: item._id.toString(),
          date: item.date?.toISOString() || null,
          description: item.notes || item.subCategory || item.category || "Expense",
          category: item.category || "Uncategorized",
          amount: item.amount,
          type: "expense"
        });
      });
    }

    if (normalizedType !== "expense") {
      const incomes = await Income.find(match).lean();
      incomes.forEach((item) => {
        transactions.push({
          id: item._id.toString(),
          date: item.date?.toISOString() || null,
          description: item.notes || item.source || "Income",
          category: item.source || "Income",
          amount: item.amount,
          type: "income"
        });
      });
    }

    transactions.sort((a, b) => b.amount - a.amount);
    const total = transactions.length;
    const paged = transactions.slice((page - 1) * limit, page * limit);

    return res.json({ transactions: paged, page, limit, total });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch top transactions", details: error.message });
  }
};

const getReportPivot = async (req, res) => {
  try {
    const { startDate, endDate, columns } = req.query;
    const range = normalizeDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ error: "Invalid or missing startDate/endDate" });
    }

    const match = { date: { $gte: range.startDate, $lte: range.endDate } };
    const columnKeys = columns
      ? columns.split(",").map((value) => value.trim()).filter(Boolean)
      : buildDateBuckets(range.startDate, range.endDate, "month");

    const rowsMap = new Map();

    const expenseGroups = await Expense.aggregate([
      { $match: match },
      {
        $project: {
          category: { $ifNull: ["$category", "Uncategorized"] },
          month: { $dateToString: { format: MONTH_FORMAT, date: "$date" } },
          amount: 1
        }
      },
      {
        $group: {
          _id: { category: "$category", month: "$month" },
          total: { $sum: "$amount" }
        }
      }
    ]);

    expenseGroups.forEach((item) => {
      const category = item._id.category || "Uncategorized";
      const month = item._id.month;
      if (!rowsMap.has(category)) {
        rowsMap.set(category, new Map());
      }
      rowsMap.get(category).set(month, item.total);
    });

    const incomeGroups = await Income.aggregate([
      { $match: match },
      {
        $project: {
          category: { $ifNull: ["$source", "Income"] },
          month: { $dateToString: { format: MONTH_FORMAT, date: "$date" } },
          amount: 1
        }
      },
      {
        $group: {
          _id: { category: "$category", month: "$month" },
          total: { $sum: "$amount" }
        }
      }
    ]);

    incomeGroups.forEach((item) => {
      const category = item._id.category || "Income";
      const month = item._id.month;
      if (!rowsMap.has(category)) {
        rowsMap.set(category, new Map());
      }
      rowsMap.get(category).set(month, (rowsMap.get(category).get(month) || 0) + item.total);
    });

    const rows = Array.from(rowsMap.entries()).map(([category, monthMap]) => ({
      category,
      values: columnKeys.map((month) => monthMap.get(month) || 0)
    }));

    const columnTotals = columnKeys.map((month, index) =>
      rows.reduce((sum, row) => sum + row.values[index], 0)
    );
    const rowTotals = rows.map((row) => row.values.reduce((sum, value) => sum + value, 0));

    return res.json({ columns: columnKeys, rows, totals: { columnTotals, rowTotals } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch pivot report", details: error.message });
  }
};

module.exports = {
  getReportSummary,
  getReportTrends,
  getReportCategoryBreakdown,
  getReportTopTransactions,
  getReportPivot
};
