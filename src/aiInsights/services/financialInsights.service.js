const Income = require("../../models/Income");
const Expense = require("../../models/Expense");
const Budget = require("../../models/Budget");
const Goal = require("../../models/Goal");
const Investment = require("../../models/Investment");
const Bill = require("../../models/Bill");
const { OllamaProvider } = require("./ollamaProvider");
const FinancialInsightsPromptBuilder = require("./financialInsightsPromptBuilder");
const FinancialCalculationService = require("./financialCalculation.service");
const { validateResponse } = require("./financialInsightsValidator");

const isDebug = process.env.NODE_ENV !== "production";
const approximateTokenCount = (text) => Math.max(0, Math.ceil((text || "").length / 4));

class FinancialInsightsService {
  constructor() {
    this.provider = new OllamaProvider();
    this.promptBuilder = new FinancialInsightsPromptBuilder();
    this.calculationService = new FinancialCalculationService();
  }

  async getFinancialInsights(familyId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const [currentMonthIncome, previousMonthIncome, yearlyIncomeData, expenseData, previousMonthExpenseData, budgetData, goalData, investmentData, billData] = await Promise.all([
      Income.find({ familyId, date: { $gte: monthStart, $lt: monthEnd } }).lean(),
      Income.find({ familyId, date: { $gte: prevMonthStart, $lt: prevMonthEnd } }).lean(),
      Income.find({ familyId, date: { $gte: yearStart, $lt: monthEnd } }).lean(),
      Expense.find({ familyId, date: { $gte: monthStart, $lt: monthEnd } }).lean(),
      Expense.find({ familyId, date: { $gte: prevMonthStart, $lt: prevMonthEnd } }).lean(),
      Budget.find({ familyId }).lean(),
      Goal.find({ familyId, status: { $ne: "ARCHIVED" } }).lean(),
      Investment.find({ familyId, isDeleted: false }).lean(),
      Bill.find({ familyId }).lean()
    ]);

    const aiContext = this.calculationService.buildAIContext({
      currentMonthIncome,
      previousMonthIncome,
      yearlyIncomeData,
      expenseData,
      previousMonthExpenseData,
      budgetData,
      goalData,
      investmentData,
      billData
    });

    const prompt = this.promptBuilder.build(aiContext);
    if (isDebug) {
      const contextString = JSON.stringify(aiContext, null, 2);
      console.log("=== AI FINANCIAL INSIGHTS DEBUG ===");
      console.log("================ PROMPT START ================");
      console.log(prompt);
      console.log("================ PROMPT END ==================");
      console.log("Final Prompt Length:", prompt.length);
      console.log("Prompt Tokens (approximate):", approximateTokenCount(prompt));
      console.log("Payload JSON Size (bytes):", Buffer.byteLength(contextString, "utf8"));
      console.log("Complete aiContext sent to AI provider:");
      console.log(contextString);
    }

    let parsed = null;
    let responseText = null;
    try {
      responseText = await this.provider.generate(prompt);
      if (isDebug) {
        console.log("Raw AI response before parsing:");
        console.log(responseText);
      }
      parsed = this.parseResponse(responseText);
    } catch (error) {
      console.warn("Ollama provider failed on first attempt:", error.message || error);
    }

    if (parsed) {
      if (isDebug) {
        console.log("Parsed JSON response:");
        console.log(JSON.stringify(parsed, null, 2));
      }
      parsed = this.sanitizeParsedResponse(parsed, aiContext);
      const validation = validateResponse(parsed);
      if (validation.success) return this.normalizeResponse(parsed, aiContext);

      try {
        const retryPrompt = [
          "The previous response did not validate against the expected schema.",
          `Validation errors: ${JSON.stringify(validation.errors)}`,
          "Please return ONLY valid JSON that conforms to the required structure. Use the supplied data and do not invent any numbers.",
          "\naiContext:",
          JSON.stringify(aiContext, null, 2)
        ].join("\n");

        const retryText = await this.provider.generate(retryPrompt);
        const retryParsed = this.parseResponse(retryText);
        if (retryParsed) {
          const sanitizedRetryParsed = this.sanitizeParsedResponse(retryParsed, aiContext);
          const retryValidation = validateResponse(sanitizedRetryParsed);
          if (retryValidation.success) return this.normalizeResponse(sanitizedRetryParsed, aiContext);
        }
      } catch (err) {
        console.warn("Ollama provider failed on retry:", err.message || err);
      }
    }

    return this.buildFallbackResponse(aiContext);
  }

  parseResponse(raw) {
    const text = (raw || "").trim();
    if (!text) return null;
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const body = match ? match[1] : text;
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  }

  sanitizeParsedResponse(parsed, aiContext) {
    if (!parsed || typeof parsed !== "object") return parsed;
    const sanitized = { ...parsed };

    if (Array.isArray(parsed.recommendations)) {
      sanitized.recommendations = parsed.recommendations.filter((item) => {
        const text = `${item.title || ""} ${item.description || ""} ${item.action || ""}`.toLowerCase();
        if (aiContext.emergencyFund.emergencyFundStatus === "COMPLETED" && text.includes("emergency")) return false;
        if (aiContext.emergencyFund.emergencyFundStatus !== "NOT_CREATED" && text.includes("create") && text.includes("emergency")) return false;
        if (text.includes("₹0") || text.includes("0 monthly") || text.includes("0/month") || text.includes("0 per month")) return false;
        return true;
      });
    }

    if (Array.isArray(parsed.goalSuggestions)) {
      sanitized.goalSuggestions = parsed.goalSuggestions.filter((item) => {
        const text = `${item.goal || ""} ${item.description || ""}`.toLowerCase();
        if (text.includes("₹0") || text.includes("0 monthly") || text.includes("0/month") || text.includes("0 per month")) return false;
        if (aiContext.emergencyFund.emergencyFundStatus !== "NOT_CREATED" && text.includes("emergency fund") && text.includes("create")) return false;
        return true;
      });
    }

    return sanitized;
  }

  normalizeResponse(parsed, aiContext) {
    const fallback = this.buildFallbackResponse(aiContext);
    return {
      summary: {
        financialHealthScore: parsed?.summary?.financialHealthScore || fallback.summary.financialHealthScore,
        overallStatus: parsed?.summary?.overallStatus || fallback.summary.overallStatus,
        message: parsed?.summary?.message || fallback.summary.message
      },
      recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations : fallback.recommendations,
      budgetInsights: Array.isArray(parsed?.budgetInsights) ? parsed.budgetInsights : fallback.budgetInsights,
      spendingInsights: Array.isArray(parsed?.spendingInsights) ? parsed.spendingInsights : fallback.spendingInsights,
      goalInsights: Array.isArray(parsed?.goalInsights) ? parsed.goalInsights : fallback.goalInsights,
      investmentInsights: Array.isArray(parsed?.investmentInsights) ? parsed.investmentInsights : fallback.investmentInsights,
      emergencyFundInsights: Array.isArray(parsed?.emergencyFundInsights) ? parsed.emergencyFundInsights : fallback.emergencyFundInsights,
      billAlerts: Array.isArray(parsed?.billAlerts) ? parsed.billAlerts : fallback.billAlerts,
      savingsTips: Array.isArray(parsed?.savingsTips) ? parsed.savingsTips : fallback.savingsTips,
      achievements: Array.isArray(parsed?.achievements) ? parsed.achievements : fallback.achievements,
      risks: Array.isArray(parsed?.risks) ? parsed.risks : fallback.risks,
      monthlyForecast: parsed?.monthlyForecast || fallback.monthlyForecast,
      investmentSuggestions: Array.isArray(parsed?.investmentSuggestions) ? parsed.investmentSuggestions : fallback.investmentSuggestions,
      goalSuggestions: Array.isArray(parsed?.goalSuggestions) ? parsed.goalSuggestions : fallback.goalSuggestions
    };
  }

  buildFallbackResponse(aiContext) {
    const recommendations = [];
    const budgetInsights = [];
    const spendingInsights = [];
    const goalInsights = [];
    const investmentInsights = [];
    const emergencyFundInsights = [];
    const achievements = [];
    const risks = [];
    const billAlerts = [];
    const savingsTips = [];
    const goalSuggestions = [];
    const investmentSuggestions = [];

    if (aiContext.spending.savingsRate < 20) {
      recommendations.push({
        type: "savings-rate",
        priority: "high",
        title: "Savings Rate Warning",
        description: `Savings rate is ${aiContext.spending.savingsRate.toFixed(1)}%. Increase your savings rate to strengthen financial resilience.`,
        action: "Reduce discretionary spending",
        icon: "wallet"
      });
    }

    if (aiContext.spending.expenseRatio > 70) {
      recommendations.push({
        type: "expense-control",
        priority: "high",
        title: "Expense Control",
        description: "Expenses are consuming a large share of income. Review recurring subscriptions and non-essential spending.",
        action: "Cut non-essential spending",
        icon: "chart"
      });
    }

    if (!aiContext.emergencyFund.hasEmergencyFundGoal) {
      recommendations.push({
        type: "emergency-fund",
        priority: "high",
        title: "Build Emergency Fund",
        description: `You have not yet created an emergency fund goal. A target of ₹${Math.round(aiContext.emergencyFund.emergencyFundTarget).toLocaleString()} is recommended.`,
        action: "Create Emergency Fund Goal",
        icon: "shield"
      });
    } else if (aiContext.emergencyFund.emergencyFundStatus === "IN_PROGRESS") {
      recommendations.push({
        type: "emergency-fund",
        priority: "medium",
        title: "Continue Emergency Fund",
        description: `You have saved ₹${Math.round(aiContext.emergencyFund.emergencyFundCurrent).toLocaleString()} of your recommended ₹${Math.round(aiContext.emergencyFund.emergencyFundTarget).toLocaleString()} emergency fund.`,
        action: "Continue Monthly Contributions",
        icon: "shield"
      });
    } else if (aiContext.emergencyFund.emergencyFundStatus === "COMPLETED") {
      achievements.push({
        title: "Emergency Fund Completed",
        description: "Your family has successfully built the recommended emergency fund.",
        icon: "shield-check"
      });
    }

    aiContext.budget.overspentCategories.forEach((item) => {
      budgetInsights.push({
        category: item.category,
        message: `${item.category} spending exceeded budget by ₹${Math.round(item.spentAmount - item.budgetAmount).toLocaleString()}.`
      });
    });

    spendingInsights.push({
      title: "Current savings and spending",
      description: `You have ₹${Math.round(aiContext.spending.savings).toLocaleString()} available after expenses.`
    });

    aiContext.goals.goals.slice(0, 3).forEach((goal) => {
      if (goal.remainingAmount === 0) {
        goalInsights.push({
          goalName: goal.goalName,
          description: "This goal has already been achieved.",
          status: "Completed"
        });
      } else {
        goalInsights.push({
          goalName: goal.goalName,
          description: `Goal status is ${goal.goalStatus}. Required contribution is ${goal.requiredMonthlyContribution !== null ? `₹${Math.round(goal.requiredMonthlyContribution).toLocaleString()}` : "not determined"}.`
        });
      }

      if (goal.requiredMonthlyContribution !== null && goal.remainingAmount > 0) {
        goalSuggestions.push({
          goal: goal.goalName,
          description: `Aim to contribute ₹${Math.round(goal.requiredMonthlyContribution).toLocaleString()} monthly to stay on track.`
        });
      }
    });

    if (aiContext.investments.profitLoss > 0) {
      investmentInsights.push({
        title: "Investment growth",
        description: `Investments are currently up by ₹${Math.round(aiContext.investments.profitLoss).toLocaleString()}.`
      });
    }

    emergencyFundInsights.push({
      title: `Emergency fund ${aiContext.emergencyFund.emergencyFundStatus.toLowerCase()}`,
      description: `Current emergency fund is ₹${Math.round(aiContext.emergencyFund.emergencyFundCurrent).toLocaleString()} compared to a target of ₹${Math.round(aiContext.emergencyFund.emergencyFundTarget).toLocaleString()}.`
    });

    if (aiContext.risks.issues.length > 0) {
      aiContext.risks.issues.forEach((issue) => risks.push(issue));
    }

    if (aiContext.achievements.details.length > 0) {
      aiContext.achievements.details.forEach((achievement) => achievements.push(achievement));
    }

    if (aiContext.bills.overdueBills > 0) {
      billAlerts.push({
        title: "Overdue Bills",
        description: `${aiContext.bills.overdueBills} bill(s) are overdue. Take action to avoid penalties.`
      });
    }

    if (aiContext.bills.upcomingBills > 0) {
      billAlerts.push({
        title: "Upcoming Bills",
        description: `${aiContext.bills.upcomingBills} bill(s) are due soon with ₹${Math.round(aiContext.bills.totalUpcomingAmount).toLocaleString()} due.`
      });
    }

    if (aiContext.spending.savings > 0) {
      savingsTips.push({
        title: "Boost savings",
        description: `Use part of your ₹${Math.round(aiContext.spending.savings).toLocaleString()} monthly savings to build emergency savings or investments.`
      });
    }

    return {
      summary: {
        financialHealthScore: aiContext.financialHealth.financialHealthScore,
        overallStatus: aiContext.financialHealth.overallStatus,
        message: `Financial health is ${aiContext.financialHealth.overallStatus.toLowerCase()} with a score of ${aiContext.financialHealth.financialHealthScore}.`
      },
      recommendations,
      budgetInsights,
      spendingInsights,
      goalInsights,
      investmentInsights,
      emergencyFundInsights,
      billAlerts,
      savingsTips,
      achievements,
      risks,
      monthlyForecast: aiContext.forecast,
      investmentSuggestions,
      goalSuggestions
    };
  }
}

module.exports = new FinancialInsightsService();
