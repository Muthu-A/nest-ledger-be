const Income = require("../models/Income");
const Expense = require("../models/Expense");
const Goal = require("../models/Goal");
const Contribution = require("../models/Contribution");

class FinancialPlannerService {
  async getPlannerData(monthKey) {
    try {
      // Determine target month (use provided monthKey YYYY-MM or default to current month)
      let now = new Date();
      let currentYear = now.getFullYear();
      let currentMonth = now.getMonth() + 1;

      if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
        const parts = monthKey.split("-").map((v) => parseInt(v, 10));
        currentYear = parts[0];
        currentMonth = parts[1];
      }

      // Fetch all data
      const incomes = await Income.find();
      const expenses = await Expense.find();
      const goals = await Goal.find();
      const contributions = await Contribution.find();
      // Filter for the target month
      const currentMonthIncomes = incomes.filter((inc) => {
        const incDate = new Date(inc.date);
        return incDate.getFullYear() === currentYear && incDate.getMonth() + 1 === currentMonth;
      });

      const currentMonthExpenses = expenses.filter((exp) => {
        const expDate = new Date(exp.date);
        return expDate.getFullYear() === currentYear && expDate.getMonth() + 1 === currentMonth;
      });

      // Calculate totals for the selected month
      const totalIncome = currentMonthIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const totalExpenses = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const totalSavings = totalIncome - totalExpenses;

      // Calculate health score
      const healthScore = this.calculateHealthScore(
        totalIncome,
        totalExpenses,
        goals,
        contributions
      );

      // Calculate salary allocation
      const salaryAllocation = this.calculateSalaryAllocation(
        totalIncome,
        totalExpenses,
        totalSavings,
        goals
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        goals,
        currentMonthExpenses,
        totalIncome,
        totalSavings,
        contributions
      );

      return {
        healthScore,
        salaryAllocation,
        recommendations
      };
    } catch (error) {
      console.error("Error in getPlannerData:", error);
      throw error;
    }
  }

  calculateHealthScore(income, expenses, goals, contributions) {
    let score = 50; // Base score

    // Income factor (max +15)
    if (income > 0) {
      score += 15;
    }

    // Savings ratio (max +25)
    if (income > 0) {
      const savingsRatio = (income - expenses) / income;
      if (savingsRatio >= 0.3) {
        score += 25;
      } else if (savingsRatio >= 0.2) {
        score += 20;
      } else if (savingsRatio >= 0.1) {
        score += 15;
      } else if (savingsRatio > 0) {
        score += 10;
      }
    }

    // Goals tracking (max +20)
    if (goals.length > 0) {
      const activeGoals = goals.filter((g) => g.status === "ACTIVE").length;
      const completedGoals = goals.filter((g) => g.status === "COMPLETED")
        .length;
      if (completedGoals > 0) {
        score += 20;
      } else if (activeGoals > 0) {
        score += 15;
      }
    }

    // Contributions consistency (max +15)
    if (contributions.length > 0) {
      score += 15;
    }

    // Expense control (max +10)
    if (expenses > 0 && income > expenses) {
      score += 10;
    }

    // Cap at 100
    score = Math.min(score, 100);

    // Determine grade
    let grade = "F";
    if (score >= 90) grade = "A+";
    else if (score >= 80) grade = "A";
    else if (score >= 70) grade = "B";
    else if (score >= 60) grade = "C";
    else if (score >= 50) grade = "D";

    return {
      score: Math.round(score),
      grade
    };
  }

  calculateSalaryAllocation(totalIncome, totalExpenses, totalSavings, goals) {
    const allocation = [];

    // Family Expenses (50% of income)
    allocation.push({
      name: "Family Expenses",
      amount: Math.round(totalIncome * 0.5),
      percentage: 50
    });

    // Goals (20% of income)
    allocation.push({
      name: "Goals",
      amount: Math.round(totalIncome * 0.2),
      percentage: 20
    });

    // Investments (15% of income)
    allocation.push({
      name: "Investments",
      amount: Math.round(totalIncome * 0.15),
      percentage: 15
    });

    // Emergency Fund (10% of income)
    allocation.push({
      name: "Emergency Fund",
      amount: Math.round(totalIncome * 0.1),
      percentage: 10
    });

    // Miscellaneous (5% of income)
    allocation.push({
      name: "Miscellaneous",
      amount: Math.round(totalIncome * 0.05),
      percentage: 5
    });

    return allocation;
  }

  generateRecommendations(
    goals,
    currentMonthExpenses,
    totalIncome,
    totalSavings,
    contributions
  ) {
    const recommendations = [];

    const hasBudget = currentMonthExpenses.length > 0;
    const hasGoals = goals.length > 0;

    // Scenario 1: No budgets and no goals
    if (!hasBudget && !hasGoals) {
      recommendations.push({
        type: "BUDGET_SETUP",
        title: "Setup Budget",
        message: "Create your first budget to track spending."
      });

      recommendations.push({
        type: "GOAL_SETUP",
        title: "Create Goals",
        message: "Create an Emergency Fund goal to build financial security."
      });

      return recommendations;
    }

    // Scenario 2: Budget exists but no goals
    if (hasBudget && !hasGoals) {
      const monthlySavings = totalIncome - (currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0));
      if (monthlySavings > 0) {
        recommendations.push({
          type: "GOAL_SETUP",
          title: "Create a Goal",
          message: `You save ₹${monthlySavings.toLocaleString(
            "en-IN"
          )} monthly. Consider creating a Car Goal or Emergency Fund.`
        });
      }
      return recommendations;
    }

    // Scenario 3: Goals exist
    if (hasGoals) {
      const goalBudgetAllocation = Math.round(totalIncome * 0.2); // 20% for goals

      goals.forEach((goal) => {
        if (goal.status === "ACTIVE") {
          const monthsRemaining = this.calculateMonthsRemaining(goal.targetDate);
          const remainingAmount = goal.targetAmount - goal.currentAmount;

          if (remainingAmount > 0) {
            // Check if goal date is in past or too soon
            const target = new Date(goal.targetDate);
            const now = new Date();
            
            if (target <= now) {
              recommendations.push({
                type: "GOAL_ALERT",
                title: "Goal Alert",
                message: `Goal "${goal.goalName}" target date has passed. Please update the target date to a future date.`
              });
            } else if (monthsRemaining <= 2) {
              // Goal is in next 1-2 months - unrealistic
              recommendations.push({
                type: "GOAL_ALERT",
                title: "Goal Alert",
                message: `Goal "${goal.goalName}" deadline is too close. Need ₹${remainingAmount.toLocaleString(
                  "en-IN"
                )} in ${monthsRemaining} month(s). Extend the deadline to make it achievable.`
              });
            } else {
              const calculatedContribution = Math.ceil(
                remainingAmount / monthsRemaining
              );

              // Only show recommendation if it's realistic
              if (calculatedContribution <= goalBudgetAllocation * 2) {
                recommendations.push({
                  type: "GOAL_CONTRIBUTION",
                  title: "Goal Contribution",
                  message: `Contribute ₹${calculatedContribution.toLocaleString(
                    "en-IN"
                  )}/month to achieve ${goal.goalName}.`
                });
              } else {
                // Show warning if target is unrealistic
                recommendations.push({
                  type: "GOAL_ALERT",
                  title: "Goal Alert",
                  message: `Goal "${goal.goalName}" requires ₹${calculatedContribution.toLocaleString(
                    "en-IN"
                  )}/month. This is too high. Increase timeline to ${Math.ceil(
                    remainingAmount / (goalBudgetAllocation * 0.5)
                  )} months or reduce goal amount.`
                });
              }
            }
          }
        }
      });
    }

    // Budget alert
    if (currentMonthExpenses.length > 0) {
      const expensesByCategory = {};
      currentMonthExpenses.forEach((exp) => {
        expensesByCategory[exp.category] =
          (expensesByCategory[exp.category] || 0) + exp.amount;
      });

      // Check for high spending categories (if any category is > 40% of total income)
      Object.entries(expensesByCategory).forEach(([category, amount]) => {
        if (amount > totalIncome * 0.4) {
          recommendations.push({
            type: "ALERT",
            title: "Budget Alert",
            message: `${category} spending (₹${amount.toLocaleString(
              "en-IN"
            )}) is high. Consider reducing expenses.`
          });
        }
      });
    }

    // Investment suggestion
    if (totalSavings > 10000) {
      const investmentAmount = Math.round(totalSavings * 0.5);
      recommendations.push({
        type: "INVESTMENT",
        title: "Investment Suggestion",
        message: `You have ₹${investmentAmount.toLocaleString(
          "en-IN"
        )} in savings. Consider investing in SIP or mutual funds.`
      });
    }

    // Emergency fund suggestion
    const emergencyFundGoal = goals.find(
      (g) => g.goalName.toLowerCase().includes("emergency")
    );
    if (!emergencyFundGoal && totalIncome > 0) {
      const recommendedEmergencyFund = totalIncome * 3; // 3 months of income
      recommendations.push({
        type: "EMERGENCY_FUND",
        title: "Build Emergency Fund",
        message: `Create an Emergency Fund goal of ₹${recommendedEmergencyFund.toLocaleString(
          "en-IN"
        )} (3 months of income).`
      });
    }

    return recommendations;
  }

  calculateMonthsRemaining(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);

    // Set both to start of day for accurate month comparison
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    // If target is in the past, return 1 month (current month only)
    if (target < now) {
      return 1;
    }

    // Calculate months remaining
    let months = 0;
    const startDate = new Date(now);

    while (startDate < target) {
      startDate.setMonth(startDate.getMonth() + 1);
      months++;
    }

    // Minimum 1 month
    return Math.max(months, 1);
  }
}

module.exports = new FinancialPlannerService();
