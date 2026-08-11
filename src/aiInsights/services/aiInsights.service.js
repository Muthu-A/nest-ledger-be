const mongoose = require("mongoose");
const Income = require("../../models/Income");
const Expense = require("../../models/Expense");
const Budget = require("../../models/Budget");
const Goal = require("../../models/Goal");
const Investment = require("../../models/Investment");
const Bill = require("../../models/Bill");
const { OllamaProvider } = require("./ollamaProvider");
const { PRIORITY, CATEGORIES, CACHE_TTL_MS } = require("../types");

class AiInsightsService {
  constructor() {
    this.cache = new Map();
    this.provider = new OllamaProvider();
  }

  async getInsightsForFamily(familyId) {
    const monthKey = this.getMonthKey(new Date());
    const cacheKey = `${familyId.toString()}:${monthKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const range = this.getCurrentMonthRange();
    const [incomeData, expenseData, budgetData, goalData, investmentData, billData] = await Promise.all([
      Income.find({ familyId, date: { $gte: range.start, $lt: range.end } }).lean(),
      Expense.find({ familyId, date: { $gte: range.start, $lt: range.end } }).lean(),
      Budget.find({ familyId, month: monthKey }).lean(),
      Goal.find({ familyId, status: { $ne: "ARCHIVED" } }).lean(),
      Investment.find({ familyId, isDeleted: false }).lean(),
      Bill.find({ familyId, dueDate: { $gte: range.start, $lt: range.end } }).lean()
    ]);

    const metrics = this.buildMetrics({
      incomeData,
      expenseData,
      budgetData,
      goalData,
      investmentData,
      billData,
      monthKey
    });

    const insights = await this.buildInsights(metrics, { incomeData, expenseData, budgetData, goalData, investmentData, billData });

    const result = {
      financialScore: this.calculateFinancialScore(metrics, insights),
      overview: {
        budgetHealth: Math.round(metrics.budgetHealth),
        investmentHealth: Math.round(metrics.investmentHealth),
        savingsRate: Math.round(metrics.savingsRate * 100) / 100
      },
      insights
    };

    this.cache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return result;
  }

  buildMetrics(payload) {
    const { incomeData, expenseData, budgetData, goalData, investmentData, billData } = payload;

    const totalIncome = incomeData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? savings / totalIncome : 0;
    const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;

    const budgetTotal = budgetData.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0);
    const expenseByCategory = expenseData.reduce((acc, item) => {
      const category = item.category || "uncategorized";
      acc[category] = (acc[category] || 0) + Number(item.amount || 0);
      return acc;
    }, {});

    const budgetUsage = budgetData.length > 0
      ? budgetData.reduce((sum, item) => {
        const spent = expenseByCategory[item.category] || 0;
        const ratio = Number(item.budgetAmount || 0) > 0 ? spent / Number(item.budgetAmount || 0) : 0;
        return sum + ratio;
      }, 0) / budgetData.length
      : 0;

    const budgetHealth = Math.max(0, 100 - budgetUsage * 100);

    const totalInvestmentValue = investmentData.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const investmentRatio = totalIncome > 0 ? totalInvestmentValue / totalIncome : 0;
    const investmentHealth = Math.min(100, investmentRatio * 100 * 4);

    const emergencyFundValue = investmentData
      .filter((item) => (item.category || "").toLowerCase() === "emergencyfund")
      .reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const emergencyFundMonths = totalExpenses > 0 ? emergencyFundValue / Math.max(totalExpenses, 1) : 0;

    const goalProgress = goalData.length > 0
      ? goalData.reduce((sum, goal) => {
        const target = Number(goal.targetAmount || 0);
        const achieved = Number(goal.currentAmount || 0);
        const ratio = target > 0 ? achieved / target : 0;
        return sum + ratio;
      }, 0) / goalData.length
      : 0;

    const overdueBills = billData.filter((bill) => bill.status === "overdue").length;
    const paidBills = billData.filter((bill) => bill.status === "paid").length;
    const billHealth = billData.length > 0 ? Math.max(0, 100 - (overdueBills / billData.length) * 100) : 100;

    return {
      totalIncome,
      totalExpenses,
      savings,
      savingsRate,
      expenseRatio,
      budgetUsage,
      budgetHealth,
      investmentRatio,
      investmentHealth,
      emergencyFundValue,
      emergencyFundMonths,
      goalProgress,
      overdueBills,
      paidBills,
      billHealth
    };
  }

  async buildInsights(metrics, data) {
    const fallbackInsights = this.buildRuleBasedInsights(metrics, data);

    try {
      const prompt = this.buildPrompt(metrics, data);
      const aiResponse = await this.provider.generate(prompt);
      const parsed = this.parseAiResponse(aiResponse);
      if (parsed && Array.isArray(parsed.insights) && parsed.insights.length > 0) {
        return this.normalizeInsights(parsed.insights, fallbackInsights);
      }
    } catch (error) {
      console.warn("Ollama AI insights unavailable, using fallback rules", error.message);
    }

    return fallbackInsights;
  }

  buildRuleBasedInsights(metrics, data) {
    const insights = [];

    if (metrics.savingsRate < 0.2) {
      insights.push(this.createInsight({
        title: "Savings rate is below target",
        description: "Your savings rate is below the recommended 20%. Consider trimming discretionary spending to build resilience.",
        priority: PRIORITY.warning,
        category: CATEGORIES.savings,
        icon: "💰"
      }));
    } else {
      insights.push(this.createInsight({
        title: "Savings habit is healthy",
        description: "Your savings rate is solid. Keep momentum by automating a small transfer each month.",
        priority: PRIORITY.good,
        category: CATEGORIES.savings,
        icon: "✅"
      }));
    }

    if (metrics.budgetHealth < 70) {
      insights.push(this.createInsight({
        title: "Budget is stretching too far",
        description: "Spending is above the planned budget in several categories. Review your monthly targets and cut non-essential spend.",
        priority: PRIORITY.critical,
        category: CATEGORIES.budget,
        icon: "📉"
      }));
    } else {
      insights.push(this.createInsight({
        title: "Budget usage is under control",
        description: "Your budget usage is staying within a healthy range for this month.",
        priority: PRIORITY.good,
        category: CATEGORIES.budget,
        icon: "📊"
      }));
    }

    if (metrics.investmentHealth > 25) {
      insights.push(this.createInsight({
        title: "Investment position looks strong",
        description: "Your current investment allocation is above the healthy benchmark. Keep a balanced approach to avoid over-concentration.",
        priority: PRIORITY.good,
        category: CATEGORIES.investments,
        icon: "📈"
      }));
    }

    if (metrics.emergencyFundMonths < 3) {
      insights.push(this.createInsight({
        title: "Emergency fund needs attention",
        description: "You have fewer than three months of expenses in emergency reserves. Build this buffer gradually.",
        priority: PRIORITY.warning,
        category: CATEGORIES.family,
        icon: "🛡️"
      }));
    }

    if (metrics.overdueBills > 0) {
      insights.push(this.createInsight({
        title: "Bill payments need attention",
        description: `You currently have ${metrics.overdueBills} overdue bill(s). Prioritize these payments to avoid late fees and protect cash flow.`,
        priority: PRIORITY.critical,
        category: CATEGORIES.bills,
        icon: "🧾"
      }));
    }

    if (metrics.goalProgress < 0.5) {
      insights.push(this.createInsight({
        title: "Goal progress is behind pace",
        description: "Your goals are progressing slowly. Consider assigning a dedicated monthly contribution to stay on track.",
        priority: PRIORITY.warning,
        category: CATEGORIES.goals,
        icon: "🎯"
      }));
    }

    return insights.slice(0, 6);
  }

  buildPrompt(metrics, data) {
    return [
      "You are a financial advisor.",
      "Analyze the following family's monthly financial summary.",
      "Return JSON only with a top-level object containing 'insights' as an array of objects with fields: id, title, description, priority, category, icon.",
      "",
      "Income",
      `${metrics.totalIncome}`,
      "Expenses",
      `${metrics.totalExpenses}`,
      "Savings",
      `${metrics.savings}`,
      "Budget Health",
      `${metrics.budgetHealth}`,
      "Investment Health",
      `${metrics.investmentHealth}`,
      "Emergency Fund Months",
      `${metrics.emergencyFundMonths}`,
      "Goal Progress",
      `${metrics.goalProgress}`,
      "Bills Overdue",
      `${metrics.overdueBills}`,
      "",
      "Provide JSON only."
    ].join("\n");
  }

  parseAiResponse(responseText) {
    const sanitized = (responseText || "").trim();
    if (!sanitized) return null;
    const codeBlockMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const body = codeBlockMatch ? codeBlockMatch[1] : sanitized;
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  }

  normalizeInsights(aiInsights, fallbackInsights) {
    if (!Array.isArray(aiInsights) || aiInsights.length === 0) {
      return fallbackInsights;
    }

    return aiInsights.map((item, index) => this.createInsight({
      title: item.title || fallbackInsights[index]?.title || "Insight",
      description: item.description || fallbackInsights[index]?.description || "",
      priority: item.priority || fallbackInsights[index]?.priority || PRIORITY.info,
      category: item.category || fallbackInsights[index]?.category || CATEGORIES.family,
      icon: item.icon || fallbackInsights[index]?.icon || "💡"
    })).slice(0, 6);
  }

  createInsight({ title, description, priority, category, icon }) {
    return {
      id: `${category.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      priority,
      category,
      icon
    };
  }

  calculateFinancialScore(metrics, insights) {
    let score = 70;

    if (metrics.savingsRate >= 0.2) score += 8;
    else if (metrics.savingsRate >= 0.1) score += 4;
    else score -= 8;

    if (metrics.budgetHealth >= 80) score += 8;
    else if (metrics.budgetHealth >= 60) score += 4;
    else score -= 8;

    if (metrics.investmentHealth >= 25) score += 6;
    else score -= 4;

    if (metrics.emergencyFundMonths >= 3) score += 6;
    else score -= 5;

    if (metrics.overdueBills > 0) score -= 15;
    if (metrics.goalProgress >= 0.5) score += 5;

    const criticalCount = insights.filter((item) => item.priority === PRIORITY.critical).length;
    const warningCount = insights.filter((item) => item.priority === PRIORITY.warning).length;
    score -= criticalCount * 6;
    score -= warningCount * 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  getMonthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
}

module.exports = new AiInsightsService();
