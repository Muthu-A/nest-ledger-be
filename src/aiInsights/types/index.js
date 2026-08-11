const PRIORITY = {
  critical: "critical",
  warning: "warning",
  good: "good",
  info: "info"
};

const CATEGORIES = {
  income: "Income",
  expenses: "Expenses",
  budget: "Budget",
  goals: "Goals",
  bills: "Bills",
  investments: "Investments",
  savings: "Savings",
  family: "Family"
};

const DEFAULT_MODEL = "llama3.2";
const CACHE_TTL_MS = 15 * 60 * 1000;

module.exports = {
  PRIORITY,
  CATEGORIES,
  DEFAULT_MODEL,
  CACHE_TTL_MS
};
