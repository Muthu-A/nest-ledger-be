const assert = require("assert");
const FinancialCalculationService = require("../src/aiInsights/services/financialCalculation.service");

function run() {
  const service = new FinancialCalculationService(new Date("2026-07-28T00:00:00Z"));

  const aiContext = service.buildAIContext({
    currentMonthIncome: [{ amount: 100000 }],
    previousMonthIncome: [{ amount: 90000 }],
    yearlyIncomeData: [{ amount: 400000 }],
    expenseData: [{ category: "Food", amount: 20000 }, { category: "Rent", amount: 25000 }, { category: "Subscriptions", amount: 1500 }],
    previousMonthExpenseData: [{ category: "Food", amount: 18000 }, { category: "Rent", amount: 25000 }],
    budgetData: [{ category: "Food", budgetAmount: 22000 }, { category: "Rent", budgetAmount: 25000 }],
    goalData: [
      { goalName: "Emergency Fund Reserve", targetAmount: 100000, currentAmount: 25000, targetDate: "2026-12-31" },
      { goalName: "New Laptop", targetAmount: 50000, currentAmount: 10000, targetDate: "2026-12-31" }
    ],
    investmentData: [{ category: "fixed deposit", amountInvested: 50000, currentValue: 52000 }],
    billData: [{ status: "upcoming", amount: 4000 }, { status: "overdue", amount: 1200 }, { status: "paid", amount: 3000 }]
  });

  assert.strictEqual(aiContext.financialHealth.financialHealthScore >= 0, true);
  assert.strictEqual(aiContext.budget.totalBudget, 47000);
  assert.strictEqual(aiContext.spending.totalIncome, 100000);
  assert.strictEqual(aiContext.bills.upcomingBills, 1);
  assert.strictEqual(Array.isArray(aiContext.goals.goals), true);
  assert.strictEqual(aiContext.emergencyFund.hasEmergencyFundGoal, true);
  assert.strictEqual(aiContext.emergencyFund.emergencyFundStatus, "IN_PROGRESS");
  assert.strictEqual(aiContext.emergencyFund.emergencyFundCurrent, 25000);
  assert.strictEqual(aiContext.emergencyFund.emergencyFundRemaining, aiContext.emergencyFund.emergencyFundTarget - 25000);
  assert.strictEqual(aiContext.investments.availableInvestmentCapacity >= 0, true);
  assert.strictEqual(Array.isArray(aiContext.achievements.details), true);
  assert.strictEqual(Array.isArray(aiContext.risks.issues), true);

  console.log("FinancialCalculationService tests passed.");
}

run();
