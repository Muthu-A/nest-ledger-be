const { z } = require("zod");

const RecommendationSchema = z.object({
  type: z.string().optional(),
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  action: z.string().optional(),
  icon: z.string().optional(),
  reason: z.string().optional()
});

const BudgetInsightSchema = z.object({
  category: z.string().optional(),
  message: z.string().optional()
});

const SpendingInsightSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const GoalInsightSchema = z.object({
  goalName: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional()
});

const InvestmentInsightSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const EmergencyFundInsightSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const BillAlertSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const SavingsTipSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const AchievementSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const RiskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional()
});

const MonthlyForecastSchema = z.object({
  projectedIncome: z.number().optional(),
  projectedExpenses: z.number().optional(),
  projectedSavings: z.number().optional(),
  projectedInvestments: z.number().optional(),
  projectedGoalContributions: z.number().optional(),
  message: z.string().optional()
});

const InvestmentSuggestionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional()
});

const GoalSuggestionSchema = z.object({
  goal: z.string().optional(),
  description: z.string().optional()
});

const ResponseSchema = z.object({
  summary: z.object({
    financialHealthScore: z.number().optional(),
    overallStatus: z.string().optional(),
    message: z.string().optional()
  }),
  recommendations: z.array(RecommendationSchema).optional(),
  budgetInsights: z.array(BudgetInsightSchema).optional(),
  spendingInsights: z.array(SpendingInsightSchema).optional(),
  goalInsights: z.array(GoalInsightSchema).optional(),
  investmentInsights: z.array(InvestmentInsightSchema).optional(),
  emergencyFundInsights: z.array(EmergencyFundInsightSchema).optional(),
  billAlerts: z.array(BillAlertSchema).optional(),
  savingsTips: z.array(SavingsTipSchema).optional(),
  achievements: z.array(AchievementSchema).optional(),
  risks: z.array(RiskSchema).optional(),
  monthlyForecast: MonthlyForecastSchema.optional(),
  investmentSuggestions: z.array(InvestmentSuggestionSchema).optional(),
  goalSuggestions: z.array(GoalSuggestionSchema).optional()
});

function validateResponse(obj) {
  try {
    const result = ResponseSchema.safeParse(obj);
    return { success: result.success, errors: result.success ? null : result.error.format() };
  } catch (err) {
    return { success: false, errors: err.message };
  }
}

module.exports = { validateResponse, ResponseSchema };
