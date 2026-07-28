const cron = require("node-cron");
const User = require("../models/User");
const Expense = require("../models/Expense");
const Income = require("../models/Income");
const Budget = require("../models/Budget");
const Bill = require("../models/Bill");
const Reminder = require("../models/Reminder");
const NotificationToken = require("../models/NotificationToken");
const socketService = require("../services/socketService");
const { sendNotification } = require("../services/notification.service");

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
};

const getUsersWithoutExpenseToday = async () => {
  const { start, end } = getTodayRange();
  const activeUserIds = await Expense.distinct("createdBy", {
    date: { $gte: start, $lt: end },
  });

  return User.find({ _id: { $nin: activeUserIds } }).lean();
};

const getUserTokens = async (userId) => {
  return NotificationToken.find({ userId }).distinct("token");
};

const sendDailyReminder = async () => {
  const users = await getUsersWithoutExpenseToday();
  if (!users.length) {
    return;
  }

  for (const user of users) {
    const tokens = await getUserTokens(user._id);
    if (!tokens.length) {
      continue;
    }
    await sendNotification(
      tokens,
      "Nest Ledger Reminder",
      "Don't forget today's expenses."
    );
  }
};

const sendWeeklySummary = async () => {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const incomeData = await Income.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    { $group: { _id: "$createdBy", totalIncome: { $sum: "$amount" } } },
  ]);
  const expenseData = await Expense.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    { $group: { _id: "$createdBy", totalExpense: { $sum: "$amount" } } },
  ]);

  const summaryMap = new Map();
  incomeData.forEach((item) => {
    summaryMap.set(item._id.toString(), { income: item.totalIncome, expense: 0 });
  });
  expenseData.forEach((item) => {
    const userId = item._id.toString();
    const summary = summaryMap.get(userId) || { income: 0, expense: 0 };
    summary.expense = item.totalExpense;
    summaryMap.set(userId, summary);
  });

  if (!summaryMap.size) {
    return;
  }

  for (const [userId, totals] of summaryMap.entries()) {
    const tokens = await getUserTokens(userId);
    if (!tokens.length) {
      continue;
    }

    const savings = Math.max(0, (totals.income || 0) - (totals.expense || 0));
    const body = `You spent ₹${(totals.expense || 0).toLocaleString("en-IN")} this week.`;
    const title = "💰 Weekly Summary";

    await sendNotification(tokens, title, body + ` Income: ₹${(totals.income || 0).toLocaleString("en-IN")}, Savings: ₹${savings.toLocaleString("en-IN")}`);
  }
};

const sendBudgetAlerts = async () => {
  const { start, end } = getMonthRange();
  const budgets = await Budget.find({}).lean();
  if (!budgets.length) {
    return;
  }

  const expenses = await Expense.aggregate([
    {
      $match: {
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: { familyId: "$familyId", category: "$category" },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const expenseMap = new Map();
  expenses.forEach((item) => {
    const key = `${item._id.familyId}_${item._id.category}`;
    expenseMap.set(key, item.totalAmount);
  });

  for (const budget of budgets) {
    const budgetCategory = budget.category;
    const key = `${budget.familyId}_${budgetCategory}`;
    const spent = expenseMap.get(key) || 0;

    if (budget.budgetAmount > 0 && spent / budget.budgetAmount >= 0.8) {
      const tokens = await NotificationToken.find({
        userId: { $in: await User.find({ familyId: budget.familyId }).distinct("_id") },
      }).distinct("token");

      if (!tokens.length) {
        continue;
      }

      const percentage = Math.round((spent / budget.budgetAmount) * 100);
      await sendNotification(
        tokens,
        "⚠ Budget Alert",
        `${budgetCategory} budget has reached ${percentage}% of ₹${budget.budgetAmount.toLocaleString("en-IN")}.`
      );
    }
  }
};

const getFamilyTokens = async (familyId) => {
  const userIds = await User.find({ familyId }).distinct("_id");
  return NotificationToken.find({ userId: { $in: userIds } }).distinct("token");
};

const sendBillReminders = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const reminders = await Reminder.find({}).populate("billId", "title dueDate status familyId").lean();
  for (const reminder of reminders) {
    const bill = reminder.billId;
    if (!bill || !bill.dueDate || bill.status === "paid") continue;
    const reminderDate = new Date(bill.dueDate);
    reminderDate.setDate(reminderDate.getDate() - Number(reminder.daysBefore || 0));
    reminderDate.setHours(0, 0, 0, 0);
    if (reminderDate.getTime() !== today.getTime()) continue;
    if (!reminder.pushEnabled && reminder.reminderType !== "push" && reminder.reminderType !== "all") continue;

    const tokens = await getFamilyTokens(bill.familyId);
    if (!tokens.length) continue;
    const title = "Bill Reminder";
    const body = `Reminder: ${bill.title} is due on ${new Date(bill.dueDate).toLocaleDateString()}.`;
    await sendNotification(tokens, title, body, { billId: bill._id.toString(), reminderId: reminder._id.toString() });
    socketService.emitToFamily(bill.familyId, "billReminder", {
      billId: bill._id,
      reminderId: reminder._id,
      title,
      body,
      dueDate: bill.dueDate
    });
  }
};

const startNotificationJobs = () => {
  cron.schedule("0 20 * * *", async () => {
    try {
      await sendDailyReminder();
    } catch (error) {
      console.error("Daily reminder job failed:", error);
    }
  });

  cron.schedule("0 9 * * 0", async () => {
    try {
      await sendWeeklySummary();
    } catch (error) {
      console.error("Weekly summary job failed:", error);
    }
  });

  cron.schedule("0 8 * * *", async () => {
    try {
      await sendBillReminders();
    } catch (error) {
      console.error("Bill reminder job failed:", error);
    }
  });

  cron.schedule("0 9 * * *", async () => {
    try {
      await sendBudgetAlerts();
    } catch (error) {
      console.error("Budget alert job failed:", error);
    }
  });
};

module.exports = {
  startNotificationJobs,
  getUsersWithoutExpenseToday,
};
