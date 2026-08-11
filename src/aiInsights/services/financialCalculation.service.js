class FinancialCalculationService {
  constructor(now = new Date()) {
    this.now = now;
  }

  buildAIContext({ currentMonthIncome, previousMonthIncome, yearlyIncomeData, expenseData, previousMonthExpenseData, budgetData, goalData, investmentData, billData }) {
    const monthlyIncome = this.sumAmounts(currentMonthIncome);
    const previousMonthlyIncome = this.sumAmounts(previousMonthIncome);
    const yearlyIncome = this.sumAmounts(yearlyIncomeData);
    const totalExpenses = this.sumAmounts(expenseData);
    // Savings is income minus expenses for the current month.
    const totalSavings = monthlyIncome - totalExpenses;
    // Savings rate as a percentage of income.
    const savingsRate = monthlyIncome > 0 ? (totalSavings / monthlyIncome) * 100 : 0;
    // Expense ratio as a percentage of income.
    const expenseRatio = monthlyIncome > 0 ? (totalExpenses / monthlyIncome) * 100 : 0;

    const categoryWiseExpenses = this.groupByCategory(expenseData);
    const topCategories = this.getTopCategories(categoryWiseExpenses);
    const recurringExpenses = this.findRecurringExpenses(expenseData);
    const unnecessaryExpenses = this.findUnnecessaryExpenses(expenseData);

    const budgetAnalysis = this.calculateBudgetAnalysis(expenseData, budgetData, categoryWiseExpenses);
    const billAnalysis = this.calculateBillAnalysis(billData);
    const emergencyFundGoal = this.findEmergencyFundGoal(goalData);
    const emergencyFund = this.calculateEmergencyFund(totalExpenses, emergencyFundGoal);
    const goalAnalysis = this.calculateGoalAnalysis(goalData, monthlyIncome, totalExpenses, billAnalysis.totalUpcomingAmount, this.now);
    const investmentAnalysis = this.calculateInvestmentAnalysis(monthlyIncome, totalExpenses, billAnalysis.totalUpcomingAmount, goalAnalysis.totalRequiredContribution, investmentData, emergencyFund);
    const forecast = this.calculateForecast(monthlyIncome, totalExpenses, investmentAnalysis.availableInvestmentCapacity, goalAnalysis.totalRequiredContribution);
    const risks = this.calculateRiskAnalysis(monthlyIncome, totalExpenses, emergencyFund, billAnalysis, goalAnalysis, investmentAnalysis);
    const achievements = this.calculateAchievements(monthlyIncome, totalExpenses, emergencyFund, budgetAnalysis, goalAnalysis, investmentAnalysis);
    const financialHealth = this.calculateFinancialHealth(monthlyIncome, totalExpenses, budgetAnalysis, goalAnalysis, emergencyFund, investmentAnalysis, billAnalysis);

    return {
      financialHealth,
      budget: budgetAnalysis,
      spending: {
        totalIncome: monthlyIncome,
        totalExpenses,
        savings: Math.max(0, totalSavings),
        savingsRate,
        expenseRatio,
        topCategories,
        recurringExpenses,
        unnecessaryExpenses,
        monthlyTrend: this.calculateMonthlyTrend(monthlyIncome, previousMonthlyIncome, totalExpenses, this.sumAmounts(previousMonthExpenseData))
      },
      goals: goalAnalysis,
      emergencyFund,
      investments: investmentAnalysis,
      bills: billAnalysis,
      forecast,
      achievements,
      risks
    };
  }

  sumAmounts(items = [], field = "amount") {
    return items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
  }

  groupByCategory(expenseData = []) {
    return expenseData.reduce((acc, item) => {
      const category = (item.category || "Uncategorized").toString();
      acc[category] = (acc[category] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  }

  getTopCategories(categoryWiseExpenses = {}) {
    return Object.entries(categoryWiseExpenses)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  findEmergencyFundGoal(goalData = []) {
    return goalData.find((goal) => {
      const category = (goal.category || "").toString().toLowerCase();
      const name = (goal.goalName || "").toString().toLowerCase();
      return category === "emergency fund"
        || name.includes("emergency fund")
        || name.includes("emergency savings")
        || name.includes("emergency");
    }) || null;
  }

  findRecurringExpenses(expenseData = []) {
    const categoryCounts = expenseData.reduce((acc, item) => {
      const category = (item.category || "Uncategorized").toString();
      acc[category] = acc[category] || { count: 0, total: 0 };
      acc[category].count += 1;
      acc[category].total += Number(item.amount || 0);
      return acc;
    }, {});

    return Object.entries(categoryCounts)
      .filter(([, value]) => value.count > 1)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5)
      .map(([category, value]) => ({
        category,
        occurrences: value.count,
        totalAmount: value.total
      }));
  }

  findUnnecessaryExpenses(expenseData = []) {
    return expenseData
      .filter((item) => Number(item.amount || 0) > 0 && Number(item.amount || 0) <= 150)
      .sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0))
      .slice(0, 5)
      .map((item) => ({
        category: item.category || "Uncategorized",
        amount: Number(item.amount || 0),
        notes: item.notes || ""
      }));
  }

  calculateBudgetAnalysis(expenseData, budgetData, categoryWiseExpenses) {
    const budgetDetails = budgetData.map((budget) => {
      const amount = Number(budget.budgetAmount || 0);
      const spent = expenseData
        .filter((expense) => (expense.category || "").toLowerCase() === (budget.category || "").toLowerCase())
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return {
        category: budget.category || "Uncategorized",
        budgetAmount: amount,
        spentAmount: spent,
        remainingAmount: Math.max(0, amount - spent),
        overspent: spent > amount
      };
    });

    const totalBudget = budgetDetails.reduce((sum, item) => sum + item.budgetAmount, 0);
    const totalSpent = budgetDetails.reduce((sum, item) => sum + item.spentAmount, 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overspentCategories: budgetDetails.filter((item) => item.overspent),
      underBudgetCategories: budgetDetails.filter((item) => !item.overspent && item.spentAmount > 0),
      unusedBudgets: budgetDetails.filter((item) => item.remainingAmount > 0),
      highestExpenseCategory: this.getTopCategories(categoryWiseExpenses)[0] || null,
      // Budget utilisation is the portion of budget already spent.
      budgetUtilisation: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      categories: budgetDetails
    };
  }

  calculateGoalAnalysis(goalData = [], monthlyIncome, totalExpenses, totalUpcomingBillAmount, now) {
    const goals = goalData.map((goal) => {
      const targetAmount = Number(goal.targetAmount || 0);
      const currentAmount = Number(goal.currentAmount || 0);
      const remainingAmount = Math.max(0, targetAmount - currentAmount);
      const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
      const monthsRemaining = targetDate ? this.calculateMonthsRemaining(now, targetDate) : null;
      // Required monthly contribution to meet the goal by target date.
      const requiredMonthlyContribution = remainingAmount === 0
        ? 0
        : (monthsRemaining && monthsRemaining > 0)
          ? remainingAmount / monthsRemaining
          : null;

      const completionProbability = this.calculateCompletionProbability({
        remainingAmount,
        requiredMonthlyContribution,
        monthlyIncome,
        totalExpenses,
        totalUpcomingBillAmount
      });

      const goalStatus = this.calculateGoalStatus({
        remainingAmount,
        targetDate,
        monthsRemaining,
        completionProbability
      });

      return {
        goalName: goal.goalName || "Unnamed Goal",
        targetAmount,
        currentAmount,
        remainingAmount,
        monthsRemaining,
        requiredMonthlyContribution: requiredMonthlyContribution !== null ? Number(requiredMonthlyContribution.toFixed(2)) : null,
        expectedCompletionDate: targetDate ? targetDate.toISOString().split("T")[0] : null,
        completionProbability,
        goalStatus
      };
    });

    const totalRequiredContribution = goals.reduce((sum, goal) => sum + (goal.requiredMonthlyContribution || 0), 0);

    return {
      goals,
      totalGoals: goals.length,
      totalRemaining: goals.reduce((sum, goal) => sum + goal.remainingAmount, 0),
      totalRequiredContribution
    };
  }

  calculateMonthsRemaining(from, to) {
    if (!to || to <= from) return 0;
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    return Math.max(1, months + (to.getDate() > from.getDate() ? 1 : 0));
  }

  calculateCompletionProbability({ remainingAmount, requiredMonthlyContribution, monthlyIncome, totalExpenses, totalUpcomingBillAmount }) {
    if (remainingAmount === 0) return "High";
    if (requiredMonthlyContribution === null) return "Unknown";

    const availableCash = Math.max(0, monthlyIncome - totalExpenses - totalUpcomingBillAmount);
    if (requiredMonthlyContribution <= availableCash) return "High";
    if (requiredMonthlyContribution <= availableCash * 1.5) return "Medium";
    return "Low";
  }

  calculateGoalStatus({ remainingAmount, targetDate, monthsRemaining, completionProbability }) {
    if (remainingAmount === 0) return "Completed";
    if (targetDate && targetDate < this.now) return "Delayed";
    if (completionProbability === "High") return "On Track";
    if (completionProbability === "Medium") return "At Risk";
    return "Delayed";
  }

  calculateEmergencyFund(totalExpenses, emergencyFundGoal = null) {
    const emergencyFundTarget = totalExpenses * 3;
    const emergencyFundCurrent = emergencyFundGoal ? Number(emergencyFundGoal.currentAmount || 0) : 0;
    const emergencyFundRemaining = Math.max(0, emergencyFundTarget - emergencyFundCurrent);
    const emergencyFundProgress = emergencyFundTarget > 0 ? (emergencyFundCurrent / emergencyFundTarget) * 100 : 0;
    let emergencyFundStatus = "NOT_CREATED";
    if (emergencyFundGoal) {
      emergencyFundStatus = emergencyFundRemaining > 0 ? "IN_PROGRESS" : "COMPLETED";
    }

    return {
      hasEmergencyFundGoal: Boolean(emergencyFundGoal),
      emergencyFundTarget,
      emergencyFundCurrent,
      emergencyFundRemaining,
      emergencyFundProgress,
      emergencyFundStatus
    };
  }

  calculateInvestmentAnalysis(monthlyIncome, totalExpenses, totalUpcomingBillAmount, totalRequiredGoalContribution, investmentData = [], emergencyFund) {
    const totalInvested = investmentData.reduce((sum, item) => sum + Number(item.amountInvested || 0), 0);
    const currentInvestmentValue = investmentData.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const profitLoss = currentInvestmentValue - totalInvested;
    const investmentReturnPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    // Investment capacity is remaining cash after expenses, upcoming bills, and goal contributions.
    const investmentCapacity = Math.max(0, monthlyIncome - totalExpenses - totalUpcomingBillAmount - totalRequiredGoalContribution);
    const availableInvestmentCapacity = Math.max(0, investmentCapacity);

    return {
      totalInvested,
      currentInvestmentValue,
      profitLoss,
      investmentReturnPercent,
      availableInvestmentCapacity,
      investmentCapacity,
      emergencyFundStatus: emergencyFund.emergencyFundStatus
    };
  }

  calculateForecast(monthlyIncome, totalExpenses, availableInvestmentCapacity, totalRequiredGoalContribution) {
    // Forecast uses current month values as the baseline projection.
    const projectedIncome = monthlyIncome;
    const projectedExpenses = totalExpenses;
    const projectedSavings = Math.max(0, monthlyIncome - totalExpenses);
    const projectedInvestments = availableInvestmentCapacity;
    const projectedGoalContributions = totalRequiredGoalContribution;

    return {
      projectedIncome,
      projectedExpenses,
      projectedSavings,
      projectedInvestments,
      projectedGoalContributions
    };
  }

  calculateBillAnalysis(billData = []) {
    const upcomingBills = billData.filter((bill) => bill.status === "upcoming");
    const overdueBills = billData.filter((bill) => bill.status === "overdue");
    const paidBills = billData.filter((bill) => bill.status === "paid");
    const totalUpcomingAmount = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);

    return {
      upcomingBills: upcomingBills.length,
      overdueBills: overdueBills.length,
      paidBills: paidBills.length,
      totalUpcomingAmount,
      upcomingBillsList: upcomingBills.slice(0, 5),
      overdueBillsList: overdueBills.slice(0, 5)
    };
  }

  calculateRiskAnalysis(monthlyIncome, totalExpenses, emergencyFund, billAnalysis, goalAnalysis, investmentAnalysis) {
    const negativeCashFlow = totalExpenses > monthlyIncome;
    const overspending = monthlyIncome > 0 ? (totalExpenses / monthlyIncome) * 100 > 70 : false;
    const lowEmergencyFund = emergencyFund.currentEmergencyFund < emergencyFund.emergencyFundTarget;
    const missedBills = billAnalysis.overdueBills > 0;
    const slowGoalProgress = goalAnalysis.goals.some((goal) => goal.completionProbability === "Low" || goal.goalStatus === "Delayed");
    const highExpenseRatio = monthlyIncome > 0 ? (totalExpenses / monthlyIncome) * 100 >= 70 : false;
    const unusedSavings = monthlyIncome - totalExpenses > 0 && investmentAnalysis.currentInvestmentValue < Math.max(0, monthlyIncome - totalExpenses);

    const issues = [];
    if (negativeCashFlow) {
      issues.push({ title: "Negative cash flow", description: "Expenses exceed income, which is a critical risk for savings and goal progress." });
    }
    if (overspending) {
      issues.push({ title: "Overspending", description: "More than 70% of income is going toward expenses." });
    }
    if (lowEmergencyFund) {
      issues.push({ title: "Low emergency fund", description: "The current emergency fund is below the recommended 3-month target." });
    }
    if (missedBills) {
      issues.push({ title: "Missed bills", description: "There are overdue bills that can hurt cash flow and credit health." });
    }
    if (slowGoalProgress) {
      issues.push({ title: "Slow goal progress", description: "At least one goal is at risk or delayed based on required contributions." });
    }
    if (highExpenseRatio) {
      issues.push({ title: "High expense ratio", description: "A large share of income is being used for expenses." });
    }
    if (unusedSavings) {
      issues.push({ title: "Unused savings", description: "There is savings available that is not currently being put to optimal use." });
    }

    return {
      negativeCashFlow,
      overspending,
      lowEmergencyFund,
      missedBills,
      slowGoalProgress,
      highExpenseRatio,
      unusedSavings,
      issues
    };
  }

  calculateAchievements(monthlyIncome, totalExpenses, emergencyFund, budgetAnalysis, goalAnalysis, investmentAnalysis) {
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - totalExpenses) / monthlyIncome) * 100 : 0;
    const completedGoals = goalAnalysis.goals.filter((goal) => goal.remainingAmount === 0).length;
    const investmentGrowth = investmentAnalysis.profitLoss > 0;
    const budgetDiscipline = budgetAnalysis.overspentCategories.length === 0;
    const consistentContributions = goalAnalysis.goals.some((goal) => goal.requiredMonthlyContribution && goal.goalStatus !== "Delayed");

    const details = [];
    if (savingsRate >= 20) {
      details.push({ title: "Strong savings rate", description: `Savings are ${savingsRate.toFixed(1)}% of income.` });
    }
    if (completedGoals > 0) {
      details.push({ title: "Completed goals", description: `${completedGoals} goal(s) have been completed.` });
    }
    if (investmentGrowth) {
      details.push({ title: "Investment growth", description: "Investments are currently generating positive returns." });
    }
    if (budgetDiscipline) {
      details.push({ title: "Budget discipline", description: "No budget categories are currently overspent." });
    }
    if (consistentContributions) {
      details.push({ title: "Consistent contributions", description: "Some goals are receiving ongoing contributions." });
    }

    return {
      highestSavingsRate: savingsRate,
      completedGoals,
      investmentGrowth,
      budgetDiscipline,
      consistentContributions,
      details
    };
  }

  calculateFinancialHealth(monthlyIncome, totalExpenses, budgetAnalysis, goalAnalysis, emergencyFund, investmentAnalysis, billAnalysis) {
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - totalExpenses) / monthlyIncome) * 100 : 0;
    const expenseRatio = monthlyIncome > 0 ? (totalExpenses / monthlyIncome) * 100 : 0;
    const budgetScore = 100 - budgetAnalysis.budgetUtilisation;
    const goalProgress = goalAnalysis.totalGoals > 0 ? (goalAnalysis.goals.reduce((sum, goal) => sum + (goal.remainingAmount === 0 ? 100 : 0), 0) / goalAnalysis.totalGoals) : 0;
    const emergencyScore = emergencyFund.currentEmergencyFund >= emergencyFund.emergencyFundTarget ? 100 : (emergencyFund.currentEmergencyFund / Math.max(1, emergencyFund.emergencyFundTarget)) * 100;
    const investmentScore = investmentAnalysis.profitLoss > 0 ? 100 : 50;
    const billScore = billAnalysis.overdueBills > 0 ? 50 : 100;

    let score = 50;
    score += Math.min(20, savingsRate); // savings is important
    score += expenseRatio <= 70 ? 10 : -10;
    score += (budgetScore / 10);
    score += goalProgress >= 50 ? 10 : 0;
    score += emergencyScore >= 100 ? 10 : 0;
    score += investmentScore >= 100 ? 5 : 0;
    score += billScore >= 100 ? 5 : -5;

    const financialHealthScore = Math.max(0, Math.min(100, Math.round(score)));
    let overallStatus = "Needs Attention";
    if (financialHealthScore >= 80) overallStatus = "Good";
    else if (financialHealthScore >= 60) overallStatus = "Moderate";

    return {
      financialHealthScore,
      overallStatus,
      scoreBreakdown: {
        savingsRate: Number(savingsRate.toFixed(1)),
        expenseRatio: Number(expenseRatio.toFixed(1)),
        budgetUtilisation: Number(budgetAnalysis.budgetUtilisation.toFixed(1)),
        goalProgress: Number(goalProgress.toFixed(1)),
        emergencyFundCoverage: Number(emergencyScore.toFixed(1)),
        investmentHealth: Number(investmentScore.toFixed(1)),
        billHealth: Number(billScore.toFixed(1))
      }
    };
  }

  calculateMonthlyTrend(currentIncome, previousIncome, currentExpenses, previousExpenses) {
    const incomeTrend = currentIncome > previousIncome ? "up" : currentIncome < previousIncome ? "down" : "stable";
    const expensesTrend = currentExpenses > previousExpenses ? "up" : currentExpenses < previousExpenses ? "down" : "stable";
    return { incomeTrend, expensesTrend };
  }
}

module.exports = FinancialCalculationService;
