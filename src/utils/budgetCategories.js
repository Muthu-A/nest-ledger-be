// Simple budget categories used for planning
const BUDGET_CATEGORIES = [
  "Food",
  "Transport",
  "Rent",
  "EMI",
  "Utilities",
  "Shopping",
  "Medical",
  "Education",
  "Entertainment",
  "Travel",
  "Others"
];

// Map budget categories to expense categories (for matching)
const BUDGET_EXPENSE_MAP = {
  "Food": ["food & groceries", "vegetables", "fruits/nuts", "provisions", "tea/coffee/snacks", "online food"],
  "Transport": ["transportation", "petrol", "vehicle service/wash", "auto/cab", "public transport", "parking charges"],
  "Rent": ["rent", "rental"],
  "EMI": ["emi"],
  "Utilities": ["home", "water", "current bill", "gas"],
  "Shopping": ["shopping/gift", "clothes/slippers", "cosmetics", "ornaments"],
  "Medical": ["medical shop", "hospital"],
  "Education": ["education"],
  "Entertainment": ["entertainment", "movie", "sports", "gym"],
  "Travel": ["travel", "vacation/trips"],
  "Others": ["other"]
};

// Get all possible expense categories that match a budget category
const getExpenseCategoriesForBudget = (budgetCategory) => {
  return BUDGET_EXPENSE_MAP[budgetCategory] || [];
};

// Normalize category name for matching
const normalizeCategoryName = (name) => {
  return name?.toLowerCase().trim() || "";
};

module.exports = {
  BUDGET_CATEGORIES,
  BUDGET_EXPENSE_MAP,
  getExpenseCategoriesForBudget,
  normalizeCategoryName
};
